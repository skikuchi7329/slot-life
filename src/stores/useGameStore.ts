import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_END_DATE, GAME_START_DATE, getEnvironment, newsBetween } from '../data/eras';
import { EVENT_RATE, EVENTS, getEvent, resolveChoices } from '../data/events';
import { pointsForRun } from '../data/legacy';
import { getMachine } from '../data/machines';
import { getParlor } from '../data/parlors';
import { getTrait } from '../data/traits';
import { autoDay, dayStrain, HYENA_MARK_PER_HOUR } from '../engine/autoplay';
import { applyLottery, drawLotteryNumber, generateFloor, isEventDay, rollQueue } from '../engine/floor';
import { advanceSession, CLOSE_TIME, makeLog, newSession, notableEvents, OPEN_TIME } from '../engine/session';
import type {
  DayLog,
  EventContext,
  Lifestyle,
  Phase,
  PlayerStats,
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

export { CLOSE_TIME, OPEN_TIME };

/** 睡眠による毎晩の基礎回復 */
const SLEEP_RECOVERY = { health: 5, mental: 2 };
/** 休みの日の回復 */
const REST_DAY = { health: 8, mental: -2 };

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
};

interface GameState {
  player: PlayerStats;
  phase: Phase;
  traitId: string | null;
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
  notices: string[];
  gameOverReason: string | null;

  startRun: (traitId: string) => void;
  planWeek: (plan: WeekPlan) => void;
  sitDown: (unitNo: number) => void;
  startHyena: () => void;
  playHour: () => void;
  playToClose: () => void;
  endSession: () => void;
  leaveFloor: () => void;
  finishShoubu: () => void;
  nextWeek: (lookAtJobs: boolean) => void;
  dismissNews: () => void;
  resolveEvent: (choiceIndex: number) => void;
  backToTitle: () => void;
}

export function eventContext(player: PlayerStats): EventContext {
  return { player, date: parseDate(player.currentDate), env: getEnvironment(player.currentDate) };
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

/** 人生の終わり判定。終わっていなければ null */
function endReason(p: PlayerStats): string | null {
  if (p.cash < 0) return '資金が尽きた。収支表の期待値の列だけが、最後まで何かを約束していた。';
  if (p.health <= 0) return '朝、起き上がれなかった。救急車の中でデータカウンターの数字を思い出していた。';
  if (p.mental <= 0) return 'ある朝、ホールに向かう足が止まった。もう数字を見たくなかった。';
  if (p.currentDate > GAME_END_DATE) return '2026年が終わった。スプレッドシートの最終行に、何を書けばいいのかわからない。';
  return null;
}

function rollEvent(player: PlayerStats, seen: string[]): string | null {
  if (Math.random() >= EVENT_RATE) return null;
  const ctx = eventContext(player);
  const eligible = EVENTS.filter((e) => e.condition(ctx) && !(e.once && seen.includes(e.id)));
  if (eligible.length === 0) return null;
  return pickWeighted(eligible, eligible.map((e) => e.weight)).id;
}

/**
 * 1日を締める。暮らし方の出費と回復、睡眠、月初の引き落としを適用して翌日に進める。
 */
function closeDay(player: PlayerStats, lifestyle: Lifestyle, traitId: string | null, week: WeekSummary): PlayerStats {
  const l = LIFESTYLES[lifestyle];
  const date = player.currentDate;
  const next = addDays(date, 1);
  const sleepHealth = SLEEP_RECOVERY.health + (hasPerk('BODY_MEMORY') ? 2 : 0);
  let cash = player.cash - lifestyleCost(lifestyle, date);
  if (parseDate(next).getDate() === 1) {
    const env = getEnvironment(next);
    const trait = getTrait(traitId ?? '');
    cash -= env.monthlyFixedCost;
    week.notices.push(`月初の引き落とし。家賃・光熱費・国保年金で ${env.monthlyFixedCost.toLocaleString()}円が消えた。`);
    if (trait.monthlyDelta !== 0) {
      cash += trait.monthlyDelta;
      week.notices.push(
        trait.monthlyDelta > 0
          ? `実家から ${trait.monthlyDelta.toLocaleString()}円が振り込まれていた。`
          : `借金の返済で ${(-trait.monthlyDelta).toLocaleString()}円が引き落とされた。`,
      );
    }
  }
  return {
    ...player,
    cash,
    currentDate: next,
    health: clamp(player.health + l.health + sleepHealth, 0, 100),
    mental: clamp(player.mental + l.mental + SLEEP_RECOVERY.mental, 0, 100),
    hallMark: clamp(player.hallMark - 1, 0, 100),
  };
}

function addToWeek(week: WeekSummary, log: DayLog, highlights: string[]) {
  if (log.actionType !== 'REST') week.workDays += 1;
  week.expectedValue += log.expectedValue;
  week.actualProfit += log.actualProfit;
  week.highlights.push(...highlights.map((h) => `${log.date.slice(5).replace('-', '/')} ${h}`));
}

/**
 * until の前日まで、方針どおりにおまかせで日々を消化する。途中で人生が終わったら理由を返す。
 */
function runDays(player: PlayerStats, until: string, plan: WeekPlan, traitId: string | null, weekStart: string, week: WeekSummary) {
  const rests = restDates(weekStart, plan);
  const append = useLogStore.getState().append;
  let p = player;
  while (p.currentDate < until) {
    if (rests.includes(p.currentDate)) {
      append(makeLog(p.currentDate, 'REST', '—', '—', null, null, '休み'));
      p = applyDelta(p, REST_DAY);
    } else {
      const r = autoDay({
        date: p.currentDate,
        parlorId: plan.parlorId,
        style: plan.style,
        hallMark: p.hallMark,
        autoJudge: hasPerk('AUTO_JUDGE'),
        thickSkin: hasPerk('THICK_SKIN'),
      });
      append(r.log);
      addToWeek(week, r.log, r.highlights);
      p = applyDelta(p, { cash: r.log.actualProfit, health: r.health, mental: r.mental, hallMark: r.hallMark });
    }
    p = closeDay(p, plan.lifestyle, traitId, week);
    const reason = endReason(p);
    if (reason) return { player: p, reason };
  }
  return { player: p, reason: null };
}

function emptyWeek(weekStart: string): WeekSummary {
  return { start: weekStart, end: addDays(weekStart, 6), workDays: 0, expectedValue: 0, actualProfit: 0, highlights: [], notices: [] };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => {
      /** 人生を終わらせ、墓標に刻む */
      const finishRun = (player: PlayerStats, reason: string) => {
        const logs = useLogStore.getState().logs;
        const weeksLived = Math.floor(logs.length / 7);
        useRunStore.getState().record({
          id: `${Date.now()}`,
          traitName: getTrait(get().traitId ?? '').name,
          startDate: GAME_START_DATE,
          endDate: player.currentDate,
          workDays: logs.filter((l) => l.actionType !== 'REST').length,
          finalCash: player.cash,
          totalEv: logs.reduce((a, l) => a + l.expectedValue, 0),
          totalTrueEv: logs.reduce((a, l) => a + l.trueExpectedValue, 0),
          totalActual: logs.reduce((a, l) => a + l.actualProfit, 0),
          reason,
          pointsEarned: pointsForRun(weeksLived, player.currentDate > GAME_END_DATE),
        });
        set({ player, phase: 'GAME_OVER', gameOverReason: reason, today: null, pendingEventId: null });
      };

      /** 勝負日：ホールへ行き、抽選を受ける */
      const goToParlor = (parlorId: string) => {
        const { player } = get();
        const parlor = getParlor(parlorId);
        const env = getEnvironment(player.currentDate);
        const eventDay = isEventDay(parlor, player.currentDate);
        const queueSize = rollQueue(parlor, env, eventDay);
        const lotteryNumber = drawLotteryNumber(queueSize);
        const floor = applyLottery(generateFloor(parlor, env, player.currentDate, eventDay), lotteryNumber, env);
        set({
          phase: 'FLOOR',
          today: { parlorId, lotteryNumber, queueSize, isEventDay: eventDay, floor, session: null },
        });
      };

      return {
        player: BLANK_PLAYER,
        phase: 'TITLE',
        traitId: null,
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
        notices: [],
        gameOverReason: null,

        startRun: (traitId) => {
          const trait = getTrait(traitId);
          useLogStore.getState().clear();
          const bonus = hasPerk('EMERGENCY_FUND') ? 150_000 : 0;
          set({
            player: { ...BLANK_PLAYER, ...trait.stats, cash: trait.stats.cash + bonus },
            phase: 'WEEK_PLAN',
            traitId,
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
            notices: [trait.intro, ...(bonus ? ['前の人生の反省で、15万円だけは手をつけずに残してある。'] : [])],
            gameOverReason: null,
          });
        },

        planWeek: (plan) => {
          const { player, traitId, weekStart } = get();
          const week = emptyWeek(weekStart);
          const until = plan.shoubu?.date ?? addDays(weekStart, 7);
          const r = runDays(player, until, plan, traitId, weekStart, week);
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
          if (!unit || unit.takenBy !== 'NONE') return;
          const machine = getMachine(unit.machineId);
          const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);
          const session = newSession(machine.type === 'TECH' ? 'TECH' : 'SETTING', unitNo, unit.machineId, unit.setting, entry);
          set({
            phase: 'PLAYING',
            today: {
              ...today,
              floor: today.floor.map((u) => (u.unitNo === unitNo ? { ...u, takenBy: 'PLAYER' } : u)),
              session,
            },
          });
        },

        startHyena: () => {
          const { today } = get();
          if (!today) return;
          const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);
          set({ phase: 'PLAYING', today: { ...today, session: newSession('HYENA', null, null, null, entry) } });
        },

        playHour: () => {
          const { today, player } = get();
          if (!today?.session) return;
          const session = advanceSession(today.session, player.hallMark, player.currentDate);
          const markUp = session.actionType === 'HYENA' ? HYENA_MARK_PER_HOUR : 0;
          set({
            today: { ...today, session },
            player: { ...player, hallMark: clamp(player.hallMark + markUp, 0, 100) },
          });
        },

        playToClose: () => {
          const { today, player } = get();
          if (!today?.session) return;
          let session = today.session;
          let hallMark = player.hallMark;
          // プレミア・確定演出を引いたら、その時点で止めて見せる
          while (session.clock < CLOSE_TIME) {
            session = advanceSession(session, hallMark, player.currentDate);
            if (session.actionType === 'HYENA') hallMark = clamp(hallMark + HYENA_MARK_PER_HOUR, 0, 100);
            const machine = session.machineId ? getMachine(session.machineId) : null;
            if (machine && notableEvents(machine, session.lastCounts).length > 0) break;
          }
          set({ today: { ...today, session }, player: { ...player, hallMark } });
        },

        endSession: () => {
          const { today, player, week } = get();
          if (!today?.session || !week) return;
          const s = today.session;
          const parlor = getParlor(today.parlorId);
          const unit = s.unitNo ? today.floor.find((u) => u.unitNo === s.unitNo) : undefined;
          const machine = s.machineId ? getMachine(s.machineId) : null;
          const machineName = machine ? `${machine.name} #${s.unitNo}` : 'ハイエナ巡回';
          const log = makeLog(
            player.currentDate,
            s.actionType,
            parlor.name,
            machineName,
            s,
            unit?.setting ?? null,
            `勝負日 ${clockLabel(s.clock)}ヤメ / 抽選${today.lotteryNumber}番`,
          );
          useLogStore.getState().append(log);
          const nextWeek = { ...week, highlights: [...week.highlights], notices: [...week.notices] };
          addToWeek(nextWeek, log, machine ? notableEvents(machine, s.counts).map((h) => `${machineName}で${h}`) : []);
          const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);
          const strain = dayStrain(log, (s.clock - entry) / 60, hasPerk('THICK_SKIN'));
          set({
            phase: 'LEDGER',
            lastLog: log,
            week: nextWeek,
            player: applyDelta(player, { cash: log.actualProfit, health: strain.health, mental: strain.mental }),
          });
        },

        leaveFloor: () => {
          const { today, player } = get();
          if (!today) return;
          const parlor = getParlor(today.parlorId);
          const log = makeLog(player.currentDate, 'REST', parlor.name, '—', null, null, `勝負日 抽選${today.lotteryNumber}番/${today.queueSize}人。座る台がなく帰宅。`);
          useLogStore.getState().append(log);
          set({ phase: 'LEDGER', lastLog: log, player: applyDelta(player, { mental: -4 }) });
        },

        finishShoubu: () => {
          const { player, plan, traitId, weekStart, week } = get();
          if (!plan || !week) return;
          const w = { ...week, highlights: [...week.highlights], notices: [...week.notices] };
          const closed = closeDay(player, plan.lifestyle, traitId, w);
          const reason = endReason(closed);
          if (reason) {
            set({ week: w });
            finishRun(closed, reason);
            return;
          }
          const r = runDays(closed, addDays(weekStart, 7), plan, traitId, weekStart, w);
          set({ week: w, player: r.player, today: null });
          if (r.reason) finishRun(r.player, r.reason);
          else set({ phase: 'WEEK_END' });
        },

        nextWeek: (lookAtJobs) => {
          const { player, seenEventIds, newsShownUntil } = get();
          const p = lookAtJobs ? applyDelta(player, { mental: -7, socialCredit: 1 }) : player;
          const reason = endReason(p);
          if (reason) {
            finishRun(p, reason);
            return;
          }
          const eventId = rollEvent(p, seenEventIds);
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

        dismissNews: () => set((s) => ({ pendingNews: s.pendingNews.slice(1) })),

        resolveEvent: (choiceIndex) => {
          const { player, pendingEventId, notices } = get();
          const event = pendingEventId ? getEvent(pendingEventId) : undefined;
          if (!event) return;
          const choice = resolveChoices(event, eventContext(player))[choiceIndex];
          const next = applyDelta(player, choice.effect);
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
      version: 3,
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
        return state as GameState;
      },
    },
  ),
);
