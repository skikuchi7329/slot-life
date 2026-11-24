import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_END_DATE, GAME_START_DATE, getEnvironment, newsBetween } from '../data/eras';
import { EVENT_RATE, EVENTS, getEvent, resolveChoices } from '../data/events';
import { getItem, itemAvailable, itemPrice, MAX_PULLERS, MAX_RUNNERS, PULLER_WAGE, RUNNER_FLOAT, RUNNER_SHARE, RUNNER_WAGE, runnerName, wage } from '../data/items';
import { pointsForRun } from '../data/legacy';
import { getMachine } from '../data/machines';
import { describeHabit, generateParlors } from '../data/parlors';
import { getTrait } from '../data/traits';
import { autoDay, dayStrain, HYENA_MARK_PER_HOUR, mergeLogs, pickUnit, runnerPlay, simulateParlorDay } from '../engine/autoplay';
import { isFree, noticeFor, snapshotOf, takeUnitsBetween } from '../engine/floor';
import { rollFloorEvent } from '../engine/floorEvents';
import { advanceSession, CLOSE_TIME, makeLog, newSession, notableEvents, OPEN_TIME } from '../engine/session';
import type {
  Crew,
  DayLog,
  EndingId,
  EventContext,
  Gear,
  Inventory,
  ItemId,
  Lifestyle,
  ParlorProfile,
  Phase,
  Placement,
  PlayerStats,
  PlaySession,
  RegulationNews,
  RunnerOrder,
  RunnerShift,
  StatDelta,
  Today,
  WeekPlan,
  WeekSummary,
} from '../types';
import { addDays, clockLabel, parseDate, signedYen } from '../utils/format';
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

const EMPTY_INVENTORY: Inventory = { owned: [], until: {}, hyenaNoteBoost: 1, knownHabits: {} };
const EMPTY_CREW: Crew = { pullers: 0, runners: [] };

/** 持ち物から、その日の稼働に効く道具・情報の状態を求める */
export function gearOf(inv: Inventory, date: string): Gear {
  const active = (id: ItemId) => (inv.until[id] ?? '') > date;
  return {
    handCounter: inv.owned.includes('HAND_COUNTER'),
    hyenaBoost: Math.max(1, active('MAGAZINE') ? 1.1 : 1, active('HYENA_NOTE') ? inv.hyenaNoteBoost : 1),
    healthGuard: inv.owned.includes('CUSHION') ? 2 : 0,
    mentalGuard: inv.owned.includes('NC_EARPHONES') ? 1 : 0,
  };
}

/** 打ち子の持ち逃げの基本確率（勝負日1日あたり。律儀さと大勝ちで変わる） */
const RUNAWAY_RATE = 0.02;

/** 勝負日に連れていく引き子・打ち子の日当 */
export function crewWage(crew: Crew, date: string): number {
  return wage(PULLER_WAGE, date) * crew.pullers + wage(RUNNER_WAGE, date) * crew.runners.length;
}

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
  inventory: Inventory;
  crew: Crew;

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
  /** 買い物。結果の一文を返す（noteの中身など） */
  buyItem: (id: ItemId, parlorId?: string) => string;
  cancelItem: (id: ItemId) => void;
  hireRunner: () => string;
  fireRunner: (runnerId: string) => void;
  hirePuller: () => void;
  firePuller: () => void;
  /** 勝負日：次の打ち子の台を決める（'AUTO' は狙い方に任せる、null は帰す） */
  /** 勝負日：次の打ち子の台と指示を決める（'AUTO' は狙い方に任せる、'HYENA' は最初からハイエナ、null は帰す） */
  assignRunner: (unitNo: number | 'AUTO' | 'HYENA' | null, order?: RunnerOrder) => void;
  /** 勝負日：今の台を捨ててハイエナに切り替える */
  switchToHyena: () => void;
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
  inventory: Inventory;
  /** 打ち子の持ち逃げで変わるので、runDays の中で書き換える */
  crew: Crew;
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
    for (const id of ctx.inventory.owned) {
      const item = getItem(id);
      if (item.kind !== 'SUBSCRIPTION') continue;
      cash -= item.price;
      notes.push(`${item.name(next)}の月会費 ${item.price.toLocaleString()}円。`);
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

/**
 * 勝負日の打ち子を締める。持ち逃げされなかった打ち子の稼働は、自分の記帳にまとめる。
 * 持ち逃げは「律儀さ」が低いほど、大勝ちした日ほど起きやすい
 */
function settleRunners(log: DayLog, shifts: RunnerShift[], crew: Crew, notices: string[]): { log: DayLog; mental: number; crew: Crew; share: number } {
  const kept: DayLog[] = [];
  let mental = 0;
  let share = 0;
  let next = crew;
  for (const shift of shifts) {
    const runner = crew.runners.find((r) => r.id === shift.runnerId);
    if (!shift.log || !runner) continue;
    const risk = RUNAWAY_RATE * (1 - runner.loyalty) * (shift.log.actualProfit > 30_000 ? 3 : 1);
    if (Math.random() < risk) {
      next = { ...next, runners: next.runners.filter((r) => r.id !== runner.id) };
      notices.push(
        `${log.date.slice(5).replace('-', '/')} 打ち子（${runner.name}）が、閉店後に戻らなかった。預けた軍資金${(runner.float / 10_000).toFixed(0)}万円と、その日の出玉ごと。電話はもうつながらない。`,
      );
      mental -= 8;
      continue;
    }
    kept.push(shift.log);
    // 勝った日は、勝ち分の歩合を渡す
    share += Math.round(Math.max(0, shift.log.actualProfit) * RUNNER_SHARE);
  }
  if (kept.length === 0) return { log, mental, crew: next, share };
  const crewProfit = kept.reduce((a, l) => a + l.actualProfit, 0);
  const merged = mergeLogs([log, ...kept], '');
  return {
    log: {
      ...merged,
      machineName: log.machineName,
      estimatedSetting: log.estimatedSetting,
      trueSetting: log.trueSetting,
      memo: `${log.memo} / 打ち子${kept.length}人 ${signedYen(crewProfit)}円`,
    },
    mental,
    crew: next,
    share,
  };
}

/** 現金が尽きたら、打ち子に預けた軍資金を引き上げる（打ち子は解散） */
function recallFloats(p: PlayerStats, ctx: DayContext): PlayerStats {
  if (p.cash >= 0 || ctx.crew.runners.length === 0) return p;
  const back = ctx.crew.runners.reduce((a, r) => a + r.float, 0);
  ctx.crew = { ...ctx.crew, runners: [] };
  ctx.week.notices.push(`現金が尽き、打ち子に預けていた軍資金 ${back.toLocaleString()}円を引き上げた。打ち子は解散した。`);
  return { ...p, cash: p.cash + back };
}

function addToWeek(week: WeekSummary, log: DayLog, highlights: string[]) {
  if (log.actionType !== 'REST') week.workDays += 1;
  week.expectedValue += log.expectedValue;
  week.actualProfit += log.actualProfit;
  week.highlights.push(...highlights.map((h) => `${log.date.slice(5).replace('-', '/')} ${h}`));
}

/** データサイトの時代は、行かなかった店の閉店後データもネットで見られる */
function recordDataSite(parlors: ParlorProfile[], date: string, skip: string | null, inventory: Inventory) {
  if (date < DATA_SITE_DATE || !inventory.owned.includes('DATA_SITE')) return;
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
      recordDataSite(parlors, p.currentDate, null, ctx.inventory);
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
        gear: gearOf(ctx.inventory, p.currentDate),
      });
      append(r.log);
      useShopDataStore.getState().record(parlor.id, r.snapshot);
      recordDataSite(parlors, p.currentDate, parlor.id, ctx.inventory);
      addToWeek(ctx.week, r.log, r.highlights);
      p = applyDelta(p, { cash: r.log.actualProfit, health: r.health, mental: r.mental, hallMark: r.hallMark });
    }
    p = recallFloats(closeDay(p, plan.lifestyle, ctx), ctx);
    const reason = endReason(p);
    if (reason) return { player: p, reason };
  }
  return { player: p, reason: null };
}

/** 有料noteの「地域ホール傾向」。3割は入れ方が外れている（書いた人の思い込み） */
function shopNoteText(p: ParlorProfile): string {
  if (Math.random() >= 0.3) return describeHabit(p);
  const others: Placement[] = (['ALL_MODEL', 'LINE', 'TAIL_NUMBER', 'CORNER', 'SCATTER'] as Placement[]).filter((x) => x !== p.placement);
  return describeHabit({ ...p, placement: others[Math.floor(Math.random() * others.length)], honesty: Math.random() });
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
          finalCash: player.cash + player.bankSavings - player.debt + get().crew.runners.reduce((a, r) => a + r.float, 0),
          totalEv: logs.reduce((a, l) => a + l.expectedValue, 0),
          totalTrueEv: logs.reduce((a, l) => a + l.trueExpectedValue, 0),
          totalActual: logs.reduce((a, l) => a + l.actualProfit, 0),
          reason: reason.text,
          pointsEarned: pointsForRun(weeksLived, reason.ending === 'SURVIVOR' || reason.ending === 'LEGEND'),
          ending: reason.ending,
        });
        set({ player, phase: 'GAME_OVER', gameOverReason: reason.text, ending: reason.ending, today: null, pendingEventId: null });
      };

          const dayCtx = (week: WeekSummary): DayContext => ({
        traitId: get().traitId,
        flags: get().flags,
        week,
        inventory: get().inventory,
        crew: get().crew,
      });
      const gear = () => gearOf(get().inventory, get().player.currentDate);

      /** 勝負日：ホールへ行き、抽選を受ける */
      const goToParlor = (parlorId: string) => {
        const { player, parlors, crew, week } = get();
        const parlor = parlors.find((p) => p.id === parlorId) ?? parlors[0];
        // 引き子・打ち子は勝負日に連れていく。若い番号から自分、打ち子の順に使う
        const { floor, notice, queue, lottery, lotteries } = simulateParlorDay(parlor, player.currentDate, 1 + crew.pullers + crew.runners.length);
        const pay = crewWage(crew, player.currentDate);
        set({
          player: { ...player, cash: player.cash - pay },
          week: week && pay > 0 ? { ...week, crewCost: (week.crewCost ?? 0) + pay } : week,
          phase: 'FLOOR',
          today: {
            parlorId,
            lotteryNumber: lottery,
            queueSize: queue,
            notice,
            floor,
            session: null,
            pastSessions: [],
            floorEvent: null,
            lotteries,
            runnerShifts: [],
          },
        });
      };

      /** 次に台を割り当てる打ち子（いなければ null） */
      const nextRunner = (today: Today) => {
        const shifts = today.runnerShifts ?? [];
        const runner = get().crew.runners[shifts.length];
        const lottery = today.lotteries?.[1 + shifts.length];
        return runner && lottery !== undefined ? { runner, lottery, prev: today.lotteries![shifts.length] } : null;
      };

      /** 次の打ち子の番号まで、他の客に台を取らせる。打ち子が残っていれば台選び（FLOOR）、いなければ遊技へ */
      const proceedToRunners = (today: Today) => {
        const next = nextRunner(today);
        if (!next) {
          set({ phase: 'PLAYING', today });
          return;
        }
        const parlor = get().parlors.find((p) => p.id === today.parlorId) ?? get().parlors[0];
        const floor = today.floor.map((u) => ({ ...u }));
        takeUnitsBetween(floor, next.prev, next.lottery, getEnvironment(get().player.currentDate), parlor, today.notice);
        set({ phase: 'FLOOR', today: { ...today, floor } });
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
        inventory: EMPTY_INVENTORY,
        crew: EMPTY_CREW,

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
            notices: [
              trait.intro,
              ...(bonus ? ['前の人生の反省で、15万円だけは手をつけずに残してある。'] : []),
              '小役カウンターは、まだ持っていない。週末に買える。',
            ],
            gameOverReason: null,
            ending: null,
            inventory: EMPTY_INVENTORY,
            crew: EMPTY_CREW,
          });
        },

        planWeek: (plan) => {
          const { player, weekStart, parlors } = get();
          const week = emptyWeek(weekStart);
          const until = plan.shoubu?.date ?? addDays(weekStart, 7);
          const ctx = dayCtx(week);
          const r = runDays(player, until, plan, parlors, weekStart, ctx);
          set({ plan, lastPlan: plan, week, player: r.player, notices: [], crew: ctx.crew });
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
          proceedToRunners(startSessionOn(today, unitNo, entry));
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

        switchToHyena: () => {
          const { today } = get();
          const s = today?.session;
          if (!today || !s || s.actionType === 'HYENA' || s.unitNo === null) return;
          // 席を立った台は、自分のデータを残して空き台になる
          const floor = today.floor.map((u) =>
            u.unitNo === s.unitNo ? { ...u, takenBy: 'OTHER' as const, quitAt: s.clock, closing: sessionData(s) } : u,
          );
          set({
            today: { ...today, floor, pastSessions: [...today.pastSessions, s], session: newSession('HYENA', null, null, null, s.clock), floorEvent: null },
          });
        },

        startHyena: () => {
          const { today } = get();
          if (!today) return;
          const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);
          proceedToRunners({ ...today, session: newSession('HYENA', null, null, null, entry) });
        },

        assignRunner: (unitNo, order = 'HOME') => {
          const { today, player, parlors, lastPlan } = get();
          if (!today?.session) return;
          const next = nextRunner(today);
          if (!next) return;
          const parlor = parlors.find((p) => p.id === today.parlorId) ?? parlors[0];
          const start = OPEN_TIME + Math.floor(next.lottery / 30);
          const floor = today.floor.map((u) => ({ ...u }));
          const free = floor.filter((u) => isFree(u, start));
          const target =
            unitNo === 'AUTO'
              ? free.length
                ? pickUnit(free, today.notice, lastPlan?.pickRule ?? 'NOTICE', player.currentDate, false)
                : null
              : unitNo === null || unitNo === 'HYENA'
                ? null
                : (free.find((u) => u.unitNo === unitNo) ?? null);
          const shift: RunnerShift = { runnerId: next.runner.id, name: next.runner.name, lottery: next.lottery, unitNo: null, log: null };
          if (target || unitNo === 'HYENA') {
            shift.log = runnerPlay({
              floor,
              unitNo: target?.unitNo ?? null,
              date: player.currentDate,
              parlor,
              notice: today.notice,
              hallMark: player.hallMark,
              handCounter: gear().handCounter,
              start,
              order: target ? order : 'HYENA',
              hyenaBoost: gear().hyenaBoost,
            });
            shift.unitNo = target?.unitNo ?? null;
            shift.order = target ? order : 'HYENA';
          }
          proceedToRunners({ ...today, floor, runnerShifts: [...(today.runnerShifts ?? []), shift] });
        },

        playHour: () => {
          const { today, player } = get();
          if (!today?.session || today.floorEvent) return;
          const prevClock = today.session.clock;
          const session = advanceSession(today.session, player.hallMark, player.currentDate, gear().hyenaBoost);
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
            session = advanceSession(session, hallMark, player.currentDate, gear().hyenaBoost);
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
            return makeLog(player.currentDate, s.actionType, parlor.name, machine ? `${machine.name} #${s.unitNo}` : 'ハイエナ巡回', s, unit?.setting ?? null, '', gear().handCounter);
          });
          const last = today.session;
          const own = mergeLogs(
            logs,
            `勝負日 抽選${today.lotteryNumber}番${sessions.length > 1 ? ` 移動${sessions.length - 1}回` : ''} ${clockLabel(last.clock)}ヤメ`,
          );
          const runnerNotes: string[] = [];
          const settled = settleRunners(own, today.runnerShifts ?? [], get().crew, runnerNotes);
          const log = settled.log;
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
          const nextWeek = {
            ...week,
            highlights: [...week.highlights],
            notices: [...week.notices, ...runnerNotes],
            crewCost: (week.crewCost ?? 0) + settled.share,
          };
          addToWeek(nextWeek, log, highlights);
          const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);
          // 心の削れは自分の稼働だけで決まる（打ち子の分は別。持ち逃げは堪える）
          const strain = dayStrain(own, (last.clock - entry) / 60, hasPerk('THICK_SKIN'), gear());
          const withCrew = (today.runnerShifts ?? []).some((x) => x.unitNo !== null);
          set({
            phase: 'LEDGER',
            lastLog: log,
            week: nextWeek,
            crew: settled.crew,
            player: applyDelta(player, {
              cash: log.actualProfit - settled.share,
              health: strain.health,
              mental: strain.mental + settled.mental,
              // 何人も連れて打つと、店に覚えられる
              hallMark: withCrew ? 3 : 0,
            }),
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
          recordDataSite(parlors, player.currentDate, today?.parlorId ?? plan.shoubu?.parlorId ?? null, get().inventory);
          const ctx = dayCtx(w);
          const closed = recallFloats(closeDay(player, plan.lifestyle, ctx), ctx);
          const reason = endReason(closed);
          if (reason) {
            set({ week: w, crew: ctx.crew });
            finishRun(closed, reason);
            return;
          }
          const r = runDays(closed, addDays(weekStart, 7), plan, parlors, weekStart, ctx);
          set({ week: w, player: r.player, today: null, crew: ctx.crew });
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

        buyItem: (id, parlorId) => {
          const { player, inventory, parlors } = get();
          const item = getItem(id);
          const date = player.currentDate;
          const price = itemPrice(item, date);
          if (!itemAvailable(item, date) || player.cash < price || (item.kind !== 'CONSUMABLE' && inventory.owned.includes(id))) return '';
          const name = item.name(date);
          let next: PlayerStats = { ...player, cash: player.cash - price };
          let inv: Inventory = inventory;
          let result = `${name}を買った。`;
          if (item.kind !== 'CONSUMABLE') {
            inv = { ...inv, owned: [...inv.owned, id] };
            if (item.kind === 'SUBSCRIPTION') result = `${name}に登録した。月初に${price.toLocaleString()}円が引き落とされる。`;
          } else if (id === 'ENERGY_DRINK') {
            next = applyDelta(next, { health: 6, mental: 1 });
            result = '一本飲んだ。……効いている気がする。';
          } else if (id === 'SHOP_NOTE') {
            const parlor = parlors.find((p) => p.id === parlorId);
            if (!parlor) return '';
            const text = shopNoteText(parlor);
            inv = { ...inv, knownHabits: { ...inv.knownHabits, [parlor.id]: text } };
            result = `${parlor.name}について書かれていた。\n「${text}」\n……本当かどうかは、データで確かめるしかない。`;
          } else if (item.weeks) {
            inv = { ...inv, until: { ...inv.until, [id]: addDays(date, item.weeks * 7) } };
            if (id === 'HYENA_NOTE') {
              const thin = Math.random() < 0.3;
              inv = { ...inv, hyenaNoteBoost: thin ? 1.05 : 1.3 };
              result = thin
                ? '読んでみた。無料ブログの寄せ集めだった。……少しは役に立つかもしれない。'
                : 'まだ出回っていない狙い目が、いくつか書いてあった。しばらくは拾える台が増えそうだ。';
            } else {
              result = `${name}を読んだ。天井とヤメどきの表を、頭に入れる。`;
            }
          }
          set({ player: next, inventory: inv });
          return result;
        },

        cancelItem: (id) => {
          const { inventory } = get();
          set({ inventory: { ...inventory, owned: inventory.owned.filter((x) => x !== id) } });
        },

        hireRunner: () => {
          const { player, crew } = get();
          if (crew.runners.length >= MAX_RUNNERS || player.cash < RUNNER_FLOAT) return '';
          const name = runnerName(crew.runners.map((r) => r.name));
          const runner = { id: `${Date.now()}`, name, float: RUNNER_FLOAT, loyalty: 0.2 + Math.random() * 0.8, since: player.currentDate };
          set({
            player: { ...player, cash: player.cash - RUNNER_FLOAT, mental: clamp(player.mental - 1, 0, 100) },
            crew: { ...crew, runners: [...crew.runners, runner] },
          });
          return `掲示板で見つけた。${name}。\n軍資金を${(RUNNER_FLOAT / 10_000).toFixed(0)}万円預けた。設定狙いの日に、自分と同じ狙い方で打ってもらう。`;
        },

        fireRunner: (runnerId) => {
          const { player, crew } = get();
          const r = crew.runners.find((x) => x.id === runnerId);
          if (!r) return;
          set({ player: { ...player, cash: player.cash + r.float }, crew: { ...crew, runners: crew.runners.filter((x) => x.id !== runnerId) } });
        },

        hirePuller: () => {
          const { crew } = get();
          if (crew.pullers >= MAX_PULLERS) return;
          set({ crew: { ...crew, pullers: crew.pullers + 1 } });
        },

        firePuller: () => {
          const { crew } = get();
          set({ crew: { ...crew, pullers: Math.max(0, crew.pullers - 1) } });
        },
      };
    },
    {
      name: 'slot-life-game',
      version: 5,
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
        // v4 には持ち物がない。進行中の人生は、今までどおりの状態（小役カウンターあり・2015年以降はデータサイト会員）で続ける
        if (version < 5) {
          const date = state.player?.currentDate ?? GAME_START_DATE;
          state = {
            ...state,
            inventory: { ...EMPTY_INVENTORY, owned: ['HAND_COUNTER', ...(date >= DATA_SITE_DATE ? (['DATA_SITE'] as ItemId[]) : [])] },
            crew: EMPTY_CREW,
          };
        }
        return state as GameState;
      },
    },
  ),
);
