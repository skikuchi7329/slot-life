import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_END_DATE, GAME_START_DATE, getEnvironment, newsBetween } from '../data/eras';
import { EVENT_RATE, EVENTS, getEvent, resolveChoices } from '../data/events';
import { pointsForRun } from '../data/legacy';
import { getMachine } from '../data/machines';
import { generateParlors } from '../data/parlors';
import { getTrait } from '../data/traits';
import { autoDay, dayStrain, HYENA_MARK_PER_HOUR, mergeLogs, simulateParlorDay } from '../engine/autoplay';
import { isFree, noticeFor, snapshotOf } from '../engine/floor';
import { rollFloorEvent } from '../engine/floorEvents';
import { advanceSession, CLOSE_TIME, makeLog, newSession, notableEvents, OPEN_TIME } from '../engine/session';
import type {
  DayLog,
  EndingId,
  EventContext,
  Lifestyle,
  ParlorProfile,
  Phase,
  PlayerStats,
  PlaySession,
  RegulationNews,
  StatDelta,
  Today,
  WeekPlan,
  WeekSummary,
} from '../types';
import { addDays, clockLabel, parseDate } from '../utils/format';
import { clamp, pickWeighted } from '../utils/math';
import { useLogStore } from './useLogStore';
import { hasPerk, useRunStore } from './useRunStore';
import { DATA_SITE_DATE, useShopDataStore } from './useShopDataStore';

export { CLOSE_TIME, OPEN_TIME };

/** 睡眠による毎晩の基礎回復 */
const SLEEP_RECOVERY = { health: 5, mental: 2 };
/** 休みの日の回復 */
const REST_DAY = { health: 8, mental: -2 };

/** 消費者金融の年利と、2010年6月の総量規制（貸金業法の完全施行） */
const LOAN_RATE = 0.18;
export const TOTAL_VOLUME_REGULATION = '2010-06-18';
/** 実家への仕送り（物語で選んだ場合） */
const SEND_MONEY = 50_000;

/** 週の暮らし方。費用は2008年時点の1日あたりの額で、物価指数が掛かる */
const LIFESTYLES: Record<Lifestyle, { label: string; cost: number; health: number; mental: number }> = {
  COOK: { label: '自炊中心（もやしと米）', cost: 350, health: 6, mental: 1 },
  CONVENIENCE: { label: 'コンビニ弁当で済ませる', cost: 850, health: 2, mental: 3 },
  SENTO: { label: '銭湯に通い、定食屋で食べる', cost: 1_450, health: 12, mental: 6 },
};
export const LIFESTYLE_LIST = Object.entries(LIFESTYLES).map(([id, v]) => ({ id: id as Lifestyle, ...v }));

export function lifestyleCost(lifestyle: Lifestyle, date: string): number {
  return Math.round(LIFESTYLES[lifestyle].cost * getEnvironment(date).priceIndex);
}

/** 休みにする曜日の優先順（日・水・木・火・月・金・土） */
const REST_PRIORITY = [0, 3, 4, 2, 1, 5, 6];

const BLANK_PLAYER: PlayerStats = {
  cash: 0,
  bankSavings: 0,
  health: 80,
  mental: 70,
  hallMark: 0,
  socialCredit: 40,
  currentDate: GAME_START_DATE,
  debt: 0,
};

interface GameState {
  player: PlayerStats;
  phase: Phase;
  traitId: string | null;
  parlors: ParlorProfile[];
  weekStart: string;
  plan: WeekPlan | null;
  lastPlan: WeekPlan | null;
  week: WeekSummary | null;
  today: Today | null;
  lastLog: DayLog | null;
  pendingNews: RegulationNews[];
  newsShownUntil: string;
  pendingEventId: string | null;
  seenEventIds: string[];
  flags: Record<string, number>;
  flagDates: Record<string, string>;
  notices: string[];
  gameOverReason: string | null;
  ending: EndingId | null;

  startRun: (traitId: string) => void;
  planWeek: (plan: WeekPlan) => void;
  sitDown: (unitNo: number) => void;
  moveTo: (unitNo: number) => void;
  startHyena: () => void;
  playHour: () => void;
  playToClose: () => void;
  resolveFloorEvent: (accept: boolean) => void;
  endSession: () => void;
  leaveFloor: () => void;
  finishShoubu: () => void;
  nextWeek: (lookAtJobs: boolean) => void;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => void;
  borrow: (amount: number) => void;
  repay: (amount: number) => void;
  dismissNews: () => void;
  resolveEvent: (choiceIndex: number) => void;
  backToTitle: () => void;
}

export function eventContext(player: PlayerStats, flags: Record<string, number> = {}, flagDates: Record<string, string> = {}): EventContext {
  return { player, date: parseDate(player.currentDate), env: getEnvironment(player.currentDate), flags, flagDates };
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** 今週休む日（勝負日は休みにしない） */
export function restDates(weekStart: string, plan: WeekPlan): string[] {
  const dates = weekDates(weekStart).filter((d) => d !== plan.shoubu?.date);
  return [...dates]
    .sort((a, b) => REST_PRIORITY.indexOf(parseDate(a).getDay()) - REST_PRIORITY.indexOf(parseDate(b).getDay()))
    .slice(0, 7 - plan.workDays);
}

/** 消費者金融で借りられる上限。総量規制後は、無職の専業はほぼ借りられない */
export function borrowLimit(p: PlayerStats): number {
  if (p.currentDate < TOTAL_VOLUME_REGULATION) return Math.max(0, 1_000_000 - p.debt);
  return p.socialCredit >= 60 ? Math.max(0, 300_000 - p.debt) : 0;
}

function applyDelta(player: PlayerStats, d: StatDelta): PlayerStats {
  return {
    ...player,
    cash: player.cash + (d.cash ?? 0),
    health: clamp(player.health + (d.health ?? 0), 0, 100),
    mental: clamp(player.mental + (d.mental ?? 0), 0, 100),
    hallMark: clamp(player.hallMark + (d.hallMark ?? 0), 0, 100),
    socialCredit: clamp(player.socialCredit + (d.socialCredit ?? 0), 0, 100),
  };
}

/** 現金が尽きたら、貯金に手をつける */
function settleCash(p: PlayerStats, notes: string[]): PlayerStats {
  if (p.cash >= 0 || p.bankSavings <= 0) return p;
  const need = Math.min(p.bankSavings, Math.ceil(-p.cash / 10_000) * 10_000);
  notes.push(`現金が尽き、貯金から ${need.toLocaleString()}円を下ろした。`);
  return { ...p, cash: p.cash + need, bankSavings: p.bankSavings - need, mental: clamp(p.mental - 5, 0, 100) };
}

/** 人生の終わり判定。終わっていなければ null */
function endReason(p: PlayerStats): { ending: EndingId; text: string } | null {
  if (p.cash < 0) return { ending: 'BANKRUPT', text: '資金が尽きた。収支表の期待値の列だけが、最後まで何かを約束していた。' };
  if (p.health <= 0) return { ending: 'BROKEN_BODY', text: '朝、起き上がれなかった。救急車の中でデータカウンターの数字を思い出していた。' };
  if (p.mental <= 0) return { ending: 'BROKEN_MIND', text: 'ある朝、ホールに向かう足が止まった。もう数字を見たくなかった。' };
  if (p.currentDate > GAME_END_DATE) {
    const worth = p.cash + p.bankSavings - p.debt;
    return worth >= 10_000_000
      ? { ending: 'LEGEND', text: `2026年が終わった。手元には${Math.round(worth / 10_000).toLocaleString()}万円。人はそれを伝説と呼ぶのかもしれない。収支表の行数だけが、自分の人生だった。` }
      : { ending: 'SURVIVOR', text: '2026年が終わった。スプレッドシートの最終行に、何を書けばいいのかわからない。' };
  }
  return null;
}

function rollEvent(ctx: EventContext, seen: string[]): string | null {
  if (Math.random() >= EVENT_RATE) return null;
  const eligible = EVENTS.filter((e) => e.condition(ctx) && !(e.once && seen.includes(e.id)));
  if (eligible.length === 0) return null;
  return pickWeighted(eligible, eligible.map((e) => e.weight)).id;
}

interface DayContext {
  traitId: string | null;
  flags: Record<string, number>;
  week: WeekSummary;
}

/**
 * 1日を締める。暮らし方の出費と回復、睡眠、月初の引き落とし（固定費・仕送り・借金の返済）を適用して翌日に進める。
 */
function closeDay(player: PlayerStats, lifestyle: Lifestyle, ctx: DayContext): PlayerStats {
  const l = LIFESTYLES[lifestyle];
  const date = player.currentDate;
  const next = addDays(date, 1);
  const sleepHealth = SLEEP_RECOVERY.health + (hasPerk('BODY_MEMORY') ? 2 : 0);
  let cash = player.cash - lifestyleCost(lifestyle, date);
  let debt = player.debt;
  const notes = ctx.week.notices;
  if (parseDate(next).getDate() === 1) {
    const env = getEnvironment(next);
    const trait = getTrait(ctx.traitId ?? '');
    cash -= env.monthlyFixedCost;
    notes.push(`月初の引き落とし。家賃・光熱費・国保年金で ${env.monthlyFixedCost.toLocaleString()}円。`);
    if (trait.monthlyDelta !== 0) {
      cash += trait.monthlyDelta;
      notes.push(trait.monthlyDelta > 0 ? `実家から ${trait.monthlyDelta.toLocaleString()}円の振り込み。` : `借金の返済で ${(-trait.monthlyDelta).toLocaleString()}円。`);
    }
    if ((ctx.flags.sendMoney ?? 0) > 0) {
      cash -= SEND_MONEY;
      notes.push(`実家への仕送り ${SEND_MONEY.toLocaleString()}円。`);
    }
    if (debt > 0) {
      const balance = Math.round(debt * (1 + LOAN_RATE / 12));
      const payment = Math.min(balance, Math.max(10_000, Math.round(balance * 0.04)));
      debt = balance - payment;
      cash -= payment;
      notes.push(`消費者金融への返済 ${payment.toLocaleString()}円（残高 ${debt.toLocaleString()}円）。`);
    }
  }
  return settleCash(
    {
      ...player,
      cash,
      debt,
      currentDate: next,
      health: clamp(player.health + l.health + sleepHealth, 0, 100),
      mental: clamp(player.mental + l.mental + SLEEP_RECOVERY.mental, 0, 100),
      hallMark: clamp(player.hallMark - 1, 0, 100),
    },
    notes,
  );
}

function addToWeek(week: WeekSummary, log: DayLog, highlights: string[]) {
  if (log.actionType !== 'REST') week.workDays += 1;
  week.expectedValue += log.expectedValue;
  week.actualProfit += log.actualProfit;
  week.highlights.push(...highlights.map((h) => `${log.date.slice(5).replace('-', '/')} ${h}`));
}

/** データサイトの時代は、行かなかった店の閉店後データもネットで見られる */
function recordDataSite(parlors: ParlorProfile[], date: string, skip: string | null) {
  if (date < DATA_SITE_DATE) return;
  const record = useShopDataStore.getState().record;
  for (const p of parlors) {
    if (p.id === skip) continue;
    const { floor, notice } = simulateParlorDay(p, date);
    record(p.id, snapshotOf(date, floor, notice));
  }
}

/**
 * until の前日まで、方針どおりにおまかせで日々を消化する。途中で人生が終わったら理由を返す。
 */
function runDays(player: PlayerStats, until: string, plan: WeekPlan, parlors: ParlorProfile[], weekStart: string, ctx: DayContext) {
  const rests = restDates(weekStart, plan);
  const append = useLogStore.getState().append;
  const home = parlors.find((p) => p.id === plan.parlorId) ?? parlors[0];
  let p = player;
  while (p.currentDate < until) {
    if (rests.includes(p.currentDate)) {
      append(makeLog(p.currentDate, 'REST', '—', '—', null, null, '休み'));
      p = applyDelta(p, REST_DAY);
      recordDataSite(parlors, p.currentDate, null);
    } else {
      // 設定狙いの日は、告知が出ている店があればそちらへ行く（いつもの店に告知があれば優先）
      const env = getEnvironment(p.currentDate);
      const noticed = parlors.filter((x) => noticeFor(x, env, p.currentDate));
      const target = plan.style !== 'HYENA' && noticed.length > 0 ? (noticed.find((x) => x.id === home.id) ?? noticed[0]) : null;
      const parlor = target ?? home;
      const style = target ? 'SETTING' : plan.style === 'TARGET' ? 'HYENA' : plan.style;
      const r = autoDay({
        date: p.currentDate,
        parlor,
        style,
        pickRule: target ? 'NOTICE' : plan.pickRule,
        hallMark: p.hallMark,
        autoJudge: hasPerk('AUTO_JUDGE'),
        thickSkin: hasPerk('THICK_SKIN'),
      });
      append(r.log);
      useShopDataStore.getState().record(parlor.id, r.snapshot);
      recordDataSite(parlors, p.currentDate, parlor.id);
      addToWeek(ctx.week, r.log, r.highlights);
      p = applyDelta(p, { cash: r.log.actualProfit, health: r.health, mental: r.mental, hallMark: r.hallMark });
    }
    p = closeDay(p, plan.lifestyle, ctx);
    const reason = endReason(p);
    if (reason) return { player: p, reason };
  }
  return { player: p, reason: null };
}

function emptyWeek(weekStart: string): WeekSummary {
  return { start: weekStart, end: addDays(weekStart, 6), workDays: 0, expectedValue: 0, actualProfit: 0, highlights: [], notices: [] };
}

function sessionData(s: PlaySession) {
  return { games: s.games, counts: s.counts, coinDiff: s.coinDiff };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => {
      /** 人生を終わらせ、墓標に刻む */
      const finishRun = (player: PlayerStats, reason: { ending: EndingId; text: string }) => {
        const logs = useLogStore.getState().logs;
        const weeksLived = Math.floor(logs.length / 7);
        useRunStore.getState().record({
          id: `${Date.now()}`,
          traitName: getTrait(get().traitId ?? '').name,
          startDate: GAME_START_DATE,
          endDate: player.currentDate,
          workDays: logs.filter((l) => l.actionType !== 'REST').length,
          finalCash: player.cash + player.bankSavings - player.debt,
          totalEv: logs.reduce((a, l) => a + l.expectedValue, 0),
          totalTrueEv: logs.reduce((a, l) => a + l.trueExpectedValue, 0),
          totalActual: logs.reduce((a, l) => a + l.actualProfit, 0),
          reason: reason.text,
          pointsEarned: pointsForRun(weeksLived, reason.ending === 'SURVIVOR' || reason.ending === 'LEGEND'),
          ending: reason.ending,
        });
        set({ player, phase: 'GAME_OVER', gameOverReason: reason.text, ending: reason.ending, today: null, pendingEventId: null });
      };

      const dayCtx = (week: WeekSummary): DayContext => ({ traitId: get().traitId, flags: get().flags, week });

      /** 勝負日：ホールへ行き、抽選を受ける */
      const goToParlor = (parlorId: string) => {
        const { player, parlors } = get();
        const parlor = parlors.find((p) => p.id === parlorId) ?? parlors[0];
        const { floor, notice, queue, lottery } = simulateParlorDay(parlor, player.currentDate);
        set({
          phase: 'FLOOR',
          today: { parlorId, lotteryNumber: lottery, queueSize: queue, notice, floor, session: null, pastSessions: [], floorEvent: null },
        });
      };

      const startSessionOn = (today: Today, unitNo: number, clock: number): Today => {
        const unit = today.floor.find((u) => u.unitNo === unitNo)!;
        const machine = getMachine(unit.machineId);
        return {
          ...today,
          floor: today.floor.map((u) => (u.unitNo === unitNo ? { ...u, takenBy: 'PLAYER' } : u)),
          session: newSession(machine.type === 'TECH' ? 'TECH' : 'SETTING', unitNo, unit.machineId, unit.setting, clock),
          floorEvent: null,
        };
      };

      return {
        player: BLANK_PLAYER,
        phase: 'TITLE',
        traitId: null,
        parlors: [],
        weekStart: GAME_START_DATE,
        plan: null,
        lastPlan: null,
        week: null,
        today: null,
        lastLog: null,
        pendingNews: [],
        newsShownUntil: GAME_START_DATE,
        pendingEventId: null,
        seenEventIds: [],
        flags: {},
        flagDates: {},
        notices: [],
        gameOverReason: null,
        ending: null,

        startRun: (traitId) => {
          const trait = getTrait(traitId);
          useLogStore.getState().clear();
          useShopDataStore.getState().clear();
          const bonus = hasPerk('EMERGENCY_FUND') ? 150_000 : 0;
          set({
            player: { ...BLANK_PLAYER, ...trait.stats, cash: trait.stats.cash + bonus },
            phase: 'WEEK_PLAN',
            traitId,
            parlors: generateParlors(),
            weekStart: GAME_START_DATE,
            plan: null,
            lastPlan: null,
            week: null,
            today: null,
            lastLog: null,
            pendingNews: [],
            newsShownUntil: GAME_START_DATE,
            pendingEventId: null,
            seenEventIds: [],
            flags: {},
            flagDates: {},
            notices: [trait.intro, ...(bonus ? ['前の人生の反省で、15万円だけは手をつけずに残してある。'] : [])],
            gameOverReason: null,
            ending: null,
          });
        },

        planWeek: (plan) => {
          const { player, weekStart, parlors } = get();
          const week = emptyWeek(weekStart);
          const until = plan.shoubu?.date ?? addDays(weekStart, 7);
          const r = runDays(player, until, plan, parlors, weekStart, dayCtx(week));
          set({ plan, lastPlan: plan, week, player: r.player, notices: [] });
          if (r.reason) {
            finishRun(r.player, r.reason);
            return;
          }
          if (plan.shoubu) goToParlor(plan.shoubu.parlorId);
          else set({ phase: 'WEEK_END' });
        },

        sitDown: (unitNo) => {
          const { today } = get();
          if (!today) return;
          const unit = today.floor.find((u) => u.unitNo === unitNo);
          const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);
          if (!unit || !isFree(unit, entry)) return;
          set({ phase: 'PLAYING', today: startSessionOn(today, unitNo, entry) });
        },

        moveTo: (unitNo) => {
          const { today } = get();
          if (!today?.session) return;
          const s = today.session;
          const unit = today.floor.find((u) => u.unitNo === unitNo);
          if (!unit || !isFree(unit, s.clock)) return;
          // 席を立った台は、自分のデータを残して空き台になる
          const floor = today.floor.map((u) =>
            u.unitNo === s.unitNo ? { ...u, takenBy: 'OTHER' as const, quitAt: s.clock, closing: sessionData(s) } : u,
          );
          set({ today: startSessionOn({ ...today, floor, pastSessions: [...today.pastSessions, s] }, unitNo, s.clock) });
        },

        startHyena: () => {
          const { today } = get();
          if (!today) return;
          const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);
          set({ phase: 'PLAYING', today: { ...today, session: newSession('HYENA', null, null, null, entry) } });
        },

        playHour: () => {
          const { today, player } = get();
          if (!today?.session || today.floorEvent) return;
          const prevClock = today.session.clock;
          const session = advanceSession(today.session, player.hallMark, player.currentDate);
          const markUp = session.actionType === 'HYENA' ? HYENA_MARK_PER_HOUR : 0;
          const floorEvent = session.actionType === 'HYENA' ? null : rollFloorEvent(today, session, prevClock, player.currentDate);
          set({
            today: { ...today, session, floorEvent },
            player: { ...player, hallMark: clamp(player.hallMark + markUp, 0, 100) },
          });
        },

        playToClose: () => {
          const { today, player } = get();
          if (!today?.session || today.floorEvent) return;
          let session = today.session;
          let hallMark = player.hallMark;
          let floorEvent = null;
          // プレミア・確定演出・島の出来事が起きたら、その時点で止めて見せる
          while (session.clock < CLOSE_TIME) {
            const prevClock = session.clock;
            session = advanceSession(session, hallMark, player.currentDate);
            if (session.actionType === 'HYENA') {
              hallMark = clamp(hallMark + HYENA_MARK_PER_HOUR, 0, 100);
              continue;
            }
            floorEvent = rollFloorEvent(today, session, prevClock, player.currentDate);
            const machine = session.machineId ? getMachine(session.machineId) : null;
            if (floorEvent || (machine && notableEvents(machine, session.lastCounts).length > 0)) break;
          }
          set({ today: { ...today, session, floorEvent }, player: { ...player, hallMark } });
        },

        resolveFloorEvent: (accept) => {
          const { today, player } = get();
          if (!today?.floorEvent || !today.session) return;
          const ev = today.floorEvent;
          const cleared = { ...today, floorEvent: null };
          if (!accept) {
            set({ today: cleared });
            return;
          }
          if (ev.kind === 'YAME' || ev.kind === 'NEIGHBOR_CONFIRM') {
            set({ today: cleared });
            get().moveTo(ev.unitNo);
          } else if (ev.kind === 'BUYOUT') {
            // 台を売って帰る。売った金は記帳しない（裏の金）
            set({ today: cleared, player: applyDelta(player, { cash: ev.price, mental: -3, hallMark: 5 }) });
            get().endSession();
          } else {
            set({ today: cleared });
          }
        },

        endSession: () => {
          const { today, player, week, parlors } = get();
          if (!today?.session || !week) return;
          const parlor = parlors.find((p) => p.id === today.parlorId) ?? parlors[0];
          const sessions = [...today.pastSessions, today.session];
          const logs = sessions.map((s) => {
            const unit = s.unitNo ? today.floor.find((u) => u.unitNo === s.unitNo) : undefined;
            const machine = s.machineId ? getMachine(s.machineId) : null;
            return makeLog(player.currentDate, s.actionType, parlor.name, machine ? `${machine.name} #${s.unitNo}` : 'ハイエナ巡回', s, unit?.setting ?? null, '');
          });
          const last = today.session;
          const log = mergeLogs(
            logs,
            `勝負日 抽選${today.lotteryNumber}番${sessions.length > 1 ? ` 移動${sessions.length - 1}回` : ''} ${clockLabel(last.clock)}ヤメ`,
          );
          useLogStore.getState().append(log);
          useShopDataStore
            .getState()
            .record(
              parlor.id,
              snapshotOf(
                player.currentDate,
                today.floor,
                today.notice,
                sessions.filter((s) => s.unitNo !== null).map((s) => ({ unitNo: s.unitNo!, data: sessionData(s) })),
              ),
            );
          const highlights = sessions.flatMap((s) => {
            const machine = s.machineId ? getMachine(s.machineId) : null;
            return machine ? notableEvents(machine, s.counts).map((h) => `${machine.name} #${s.unitNo}で${h}`) : [];
          });
          const nextWeek = { ...week, highlights: [...week.highlights], notices: [...week.notices] };
          addToWeek(nextWeek, log, highlights);
          const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);
          const strain = dayStrain(log, (last.clock - entry) / 60, hasPerk('THICK_SKIN'));
          set({
            phase: 'LEDGER',
            lastLog: log,
            week: nextWeek,
            player: applyDelta(player, { cash: log.actualProfit, health: strain.health, mental: strain.mental }),
          });
        },

        leaveFloor: () => {
          const { today, player, parlors } = get();
          if (!today) return;
          const parlor = parlors.find((p) => p.id === today.parlorId) ?? parlors[0];
          const log = makeLog(player.currentDate, 'REST', parlor.name, '—', null, null, `勝負日 抽選${today.lotteryNumber}番/${today.queueSize}人。座る台がなく帰宅。`);
          useLogStore.getState().append(log);
          useShopDataStore.getState().record(parlor.id, snapshotOf(player.currentDate, today.floor, today.notice));
          set({ phase: 'LEDGER', lastLog: log, player: applyDelta(player, { mental: -4 }) });
        },

        finishShoubu: () => {
          const { player, plan, weekStart, week, parlors, today } = get();
          if (!plan || !week) return;
          const w = { ...week, highlights: [...week.highlights], notices: [...week.notices] };
          recordDataSite(parlors, player.currentDate, today?.parlorId ?? plan.shoubu?.parlorId ?? null);
          const closed = closeDay(player, plan.lifestyle, dayCtx(w));
          const reason = endReason(closed);
          if (reason) {
            set({ week: w });
            finishRun(closed, reason);
            return;
          }
          const r = runDays(closed, addDays(weekStart, 7), plan, parlors, weekStart, dayCtx(w));
          set({ week: w, player: r.player, today: null });
          if (r.reason) finishRun(r.player, r.reason);
          else set({ phase: 'WEEK_END' });
        },

        nextWeek: (lookAtJobs) => {
          const { player, seenEventIds, newsShownUntil, flags, flagDates } = get();
          const p = lookAtJobs ? applyDelta(player, { mental: -7, socialCredit: 1 }) : player;
          const reason = endReason(p);
          if (reason) {
            finishRun(p, reason);
            return;
          }
          const eventId = rollEvent(eventContext(p, flags, flagDates), seenEventIds);
          set({
            player: p,
            phase: 'WEEK_PLAN',
            weekStart: p.currentDate,
            plan: null,
            week: null,
            today: null,
            notices: [],
            pendingEventId: eventId,
            seenEventIds: eventId ? [...seenEventIds, eventId] : seenEventIds,
            pendingNews: [...get().pendingNews, ...newsBetween(newsShownUntil, p.currentDate)],
            newsShownUntil: p.currentDate,
          });
        },

        deposit: (amount) => {
          const { player } = get();
          const a = Math.min(amount, Math.max(0, player.cash));
          set({ player: { ...player, cash: player.cash - a, bankSavings: player.bankSavings + a } });
        },

        withdraw: (amount) => {
          const { player } = get();
          const a = Math.min(amount, player.bankSavings);
          set({ player: { ...player, cash: player.cash + a, bankSavings: player.bankSavings - a, mental: clamp(player.mental - 2, 0, 100) } });
        },

        borrow: (amount) => {
          const { player } = get();
          const a = Math.min(amount, borrowLimit(player));
          if (a <= 0) return;
          set({ player: { ...player, cash: player.cash + a, debt: player.debt + a, mental: clamp(player.mental - 4, 0, 100), socialCredit: clamp(player.socialCredit - 3, 0, 100) } });
        },

        repay: (amount) => {
          const { player } = get();
          const a = Math.min(amount, player.debt, Math.max(0, player.cash));
          set({ player: { ...player, cash: player.cash - a, debt: player.debt - a } });
        },

        dismissNews: () => set((s) => ({ pendingNews: s.pendingNews.slice(1) })),

        resolveEvent: (choiceIndex) => {
          const { player, pendingEventId, notices, flags, flagDates } = get();
          const event = pendingEventId ? getEvent(pendingEventId) : undefined;
          if (!event) return;
          const choice = resolveChoices(event, eventContext(player, flags, flagDates))[choiceIndex];
          const next = settleCash(applyDelta(player, choice.effect), []);
          const nextFlags = { ...flags };
          const nextDates = { ...flagDates };
          for (const [k, v] of Object.entries(choice.setFlags ?? {})) {
            nextFlags[k] = (nextFlags[k] ?? 0) + v;
            nextDates[k] = player.currentDate;
          }
          set({ flags: nextFlags, flagDates: nextDates });
          if (choice.endRun) {
            finishRun(next, choice.endRun);
            return;
          }
          const reason = endReason(next);
          if (reason) {
            finishRun(next, reason);
            return;
          }
          set({ player: next, pendingEventId: null, notices: [choice.result, ...notices] });
        },

        backToTitle: () => set({ phase: 'TITLE', today: null, gameOverReason: null }),
      };
    },
    {
      name: 'slot-life-game',
      version: 4,
      migrate: (persisted, version) => {
        const s = persisted as Partial<GameState> & { phase?: string };
        let state = s;
        // v1 は出自・イベントの概念がない。進行中のセーブは「元SE」として続行させる
        if (version < 2) {
          state = { ...state, traitId: state.traitId ?? 'ex_se', pendingEventId: null, seenEventIds: [] };
        }
        // v2 は1日単位。進行中の日は破棄し、その日から始まる週の方針決めに戻す
        if (version < 3) {
          const inRun = state.phase && state.phase !== 'TITLE' && state.phase !== 'GAME_OVER';
          state = {
            ...state,
            phase: (inRun ? 'WEEK_PLAN' : state.phase) as Phase,
            weekStart: state.player?.currentDate ?? GAME_START_DATE,
            plan: null,
            lastPlan: null,
            week: null,
            today: null,
            newsShownUntil: state.player?.currentDate ?? GAME_START_DATE,
          };
        }
        // v3 は店が固定3軒。進行中の人生には新しい街（6軒）を与え、勝負日の途中なら週の方針決めに戻す
        if (version < 4) {
          const inDay = state.phase === 'FLOOR' || state.phase === 'PLAYING' || state.phase === 'LEDGER';
          state = {
            ...state,
            phase: (inDay ? 'WEEK_PLAN' : state.phase) as Phase,
            weekStart: inDay ? (state.player?.currentDate ?? GAME_START_DATE) : state.weekStart,
            parlors: generateParlors(),
            plan: null,
            lastPlan: null,
            today: null,
            flags: {},
            flagDates: {},
            ending: null,
            player: state.player ? { ...state.player, debt: state.player.debt ?? 0 } : state.player,
          };
        }
        return state as GameState;
      },
    },
  ),
);
