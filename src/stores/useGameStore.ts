import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GAME_END_DATE, GAME_START_DATE, getEnvironment, newsBetween } from '../data/eras';
import { EVENT_RATE, EVENTS, getEvent, resolveChoices } from '../data/events';
import { getMachine } from '../data/machines';
import { getParlor } from '../data/parlors';
import { getTrait } from '../data/traits';
import { applyLottery, drawLotteryNumber, generateFloor, isEventDay, rollQueue } from '../engine/floor';
import { COINS_PER_1000_YEN, coinsToYen, estimateFromCounters, simulateGames } from '../engine/simulation';
import type {
  ActionType,
  DayLog,
  EventContext,
  NightAction,
  Phase,
  PlayerStats,
  PlaySession,
  RegulationNews,
  StatDelta,
  Today,
} from '../types';
import { addDays, clockLabel, parseDate, signedCoins } from '../utils/format';
import { clamp, pickWeighted, sampleNormal } from '../utils/math';
import { useLogStore } from './useLogStore';
import { useRunStore } from './useRunStore';

export const OPEN_TIME = 10 * 60;
export const CLOSE_TIME = 22 * 60 + 45;

/** 月初に引き落とされる固定費（家賃・光熱通信・国保年金） */
export const MONTHLY_FIXED_COST = 95_000;

/** ハイエナ1時間あたりの差枚の標準偏差（拾った台の当否で大きくぶれる） */
const HYENA_SD_PER_HOUR = 550;
/** ハイエナ1時間ごとの店マーク上昇 */
const HYENA_MARK_PER_HOUR = 1;
/** 睡眠による毎晩の基礎回復 */
const SLEEP_RECOVERY = { health: 5, mental: 2 };

const NIGHT_ACTIONS: Record<NightAction, { label: string; cost: number; health: number; mental: number; social: number }> = {
  COOK: { label: '自炊する（もやし炒め）', cost: 350, health: 6, mental: 1, social: 0 },
  CONVENIENCE: { label: 'コンビニ弁当で済ませる', cost: 850, health: 2, mental: 3, social: 0 },
  SENTO: { label: '銭湯に行って定食を食べる', cost: 1_450, health: 12, mental: 6, social: 0 },
  JOB_SITE: { label: '求人サイトを眺める', cost: 0, health: 0, mental: -7, social: 1 },
};
export const NIGHT_ACTION_LIST = Object.entries(NIGHT_ACTIONS).map(([id, v]) => ({ id: id as NightAction, ...v }));

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
  today: Today | null;
  lastLog: DayLog | null;
  pendingNews: RegulationNews[];
  pendingEventId: string | null;
  seenEventIds: string[];
  notices: string[];
  gameOverReason: string | null;

  startRun: (traitId: string) => void;
  goToParlor: (parlorId: string) => void;
  restDay: () => void;
  sitDown: (unitNo: number) => void;
  startHyena: () => void;
  playHour: () => void;
  playToClose: () => void;
  endSession: () => void;
  leaveFloor: () => void;
  nightAction: (action: NightAction) => void;
  dismissNews: () => void;
  resolveEvent: (choiceIndex: number) => void;
  backToTitle: () => void;
}

export function eventContext(player: PlayerStats): EventContext {
  return { player, date: parseDate(player.currentDate), env: getEnvironment(player.currentDate) };
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

function newSession(
  actionType: ActionType,
  unitNo: number | null,
  machineId: string | null,
  unitSetting: number | null,
  clock: number,
): PlaySession {
  return {
    unitNo,
    machineId,
    unitSetting,
    actionType,
    games: 0,
    counts: {},
    lastCounts: {},
    coinDiff: 0,
    coinsInHand: 0,
    cashInvested: 0,
    expectedCoins: 0,
    coinVariance: 0,
    clock,
    log: [],
  };
}

/** 持ちメダルが尽きたら1000円単位で借りる */
function topUp(session: PlaySession): PlaySession {
  if (session.coinsInHand >= 0) return session;
  const units = Math.ceil(-session.coinsInHand / COINS_PER_1000_YEN);
  return { ...session, coinsInHand: session.coinsInHand + units * COINS_PER_1000_YEN, cashInvested: session.cashInvested + units * 1000 };
}

function advanceSession(session: PlaySession, hallMark: number, date: string): PlaySession {
  const env = getEnvironment(date);
  const minutes = Math.min(60, CLOSE_TIME - session.clock);
  if (minutes <= 0) return session;

  if (session.actionType === 'HYENA') {
    const hours = minutes / 60;
    const mean = env.hyenaCoinsPerHour * (1 - hallMark / 200) * hours;
    const sd = HYENA_SD_PER_HOUR * Math.sqrt(hours);
    const diff = Math.round(sampleNormal(mean, sd));
    return topUp({
      ...session,
      clock: session.clock + minutes,
      coinDiff: session.coinDiff + diff,
      coinsInHand: session.coinsInHand + diff,
      expectedCoins: session.expectedCoins + mean,
      coinVariance: session.coinVariance + sd ** 2,
      lastCounts: {},
      log: [...session.log, `${clockLabel(session.clock)} 島を巡回 ${signedCoins(diff)}`],
    });
  }

  const machine = getMachine(session.machineId!);
  const unitSetting = session.unitSetting!;
  const games = Math.round((machine.gamesPerHour * minutes) / 60);
  const r = simulateGames(machine, unitSetting, games);
  const counts = { ...session.counts };
  for (const [k, v] of Object.entries(r.counts)) counts[k] = (counts[k] ?? 0) + v;
  return topUp({
    ...session,
    clock: session.clock + minutes,
    games: session.games + games,
    counts,
    lastCounts: r.counts,
    coinDiff: session.coinDiff + r.coinDiff,
    coinsInHand: session.coinsInHand + r.coinDiff,
    expectedCoins: session.expectedCoins + r.expectedCoins,
    coinVariance: session.coinVariance + r.variance,
    log: [...session.log, `${clockLabel(session.clock)} ${games}G消化 ${signedCoins(r.coinDiff)}`],
  });
}

function makeLog(
  date: string,
  actionType: ActionType,
  parlorName: string,
  machineName: string,
  session: PlaySession | null,
  trueSetting: number | null,
  memo: string,
): DayLog {
  const env = getEnvironment(date);
  const rate = env.exchangeRate;
  // 設定狙いは小役カウンターからの推定でしか期待値を知り得ない。ハイエナは天井・ゾーンの期待値が既知
  const estimate =
    session?.machineId && session.games > 0 ? estimateFromCounters(getMachine(session.machineId), session.games, session.counts) : null;
  const estCoins = estimate?.expectedCoins ?? session?.expectedCoins ?? 0;
  const estVariance = estimate?.variance ?? session?.coinVariance ?? 0;
  return {
    date,
    era: env.era.id,
    actionType,
    parlorName,
    machineName,
    gamesPlayed: session?.games ?? 0,
    expectedValue: session ? coinsToYen(estCoins, session.cashInvested, rate) : 0,
    actualProfit: session ? coinsToYen(session.coinDiff, session.cashInvested, rate) : 0,
    sigma: rate * Math.sqrt(estVariance),
    cashInvested: session?.cashInvested ?? 0,
    estimatedSetting: estimate?.meanSetting ?? null,
    trueExpectedValue: session ? coinsToYen(session.expectedCoins, session.cashInvested, rate) : 0,
    trueSetting,
    memo,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => {
      /** 人生を終わらせ、墓標に刻む */
      const finishRun = (player: PlayerStats, reason: string) => {
        const logs = useLogStore.getState().logs;
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
        });
        set({ player, phase: 'GAME_OVER', gameOverReason: reason, today: null, pendingEventId: null });
      };

      return {
        player: BLANK_PLAYER,
        phase: 'TITLE',
        traitId: null,
        today: null,
        lastLog: null,
        pendingNews: [],
        pendingEventId: null,
        seenEventIds: [],
        notices: [],
        gameOverReason: null,

        startRun: (traitId) => {
          const trait = getTrait(traitId);
          useLogStore.getState().clear();
          set({
            player: { ...BLANK_PLAYER, ...trait.stats },
            phase: 'MORNING',
            traitId,
            today: null,
            lastLog: null,
            pendingNews: [],
            pendingEventId: null,
            seenEventIds: [],
            notices: [trait.intro],
            gameOverReason: null,
          });
        },

        goToParlor: (parlorId) => {
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
            player: { ...player, health: clamp(player.health - 2, 0, 100) },
          });
        },

        restDay: () => {
          const { player } = get();
          const log = makeLog(player.currentDate, 'REST', '—', '—', null, null, '休養日。何もしない一日に罪悪感だけが積もる。');
          useLogStore.getState().append(log);
          set({
            phase: 'LEDGER',
            lastLog: log,
            player: { ...player, health: clamp(player.health + 8, 0, 100), mental: clamp(player.mental - 2, 0, 100) },
          });
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
          while (session.clock < CLOSE_TIME) {
            session = advanceSession(session, hallMark, player.currentDate);
            if (session.actionType === 'HYENA') hallMark = clamp(hallMark + HYENA_MARK_PER_HOUR, 0, 100);
          }
          set({ today: { ...today, session }, player: { ...player, hallMark } });
        },

        endSession: () => {
          const { today, player } = get();
          if (!today?.session) return;
          const s = today.session;
          const parlor = getParlor(today.parlorId);
          const unit = s.unitNo ? today.floor.find((u) => u.unitNo === s.unitNo) : undefined;
          const machineName = s.machineId ? `${getMachine(s.machineId).name} #${s.unitNo}` : 'ハイエナ巡回';
          const log = makeLog(
            player.currentDate,
            s.actionType,
            parlor.name,
            machineName,
            s,
            unit?.setting ?? null,
            `${clockLabel(s.clock)}ヤメ。投資${(s.cashInvested / 1000).toFixed(0)}k / 抽選${today.lotteryNumber}番`,
          );
          useLogStore.getState().append(log);

          // 期待値からの乖離（σ単位）が精神を削る。勝っても期待値以下なら虚しい
          const z = log.sigma > 0 ? (log.actualProfit - log.expectedValue) / log.sigma : 0;
          const hours = (s.clock - OPEN_TIME) / 60;
          set({
            phase: 'LEDGER',
            lastLog: log,
            player: {
              ...player,
              cash: player.cash + log.actualProfit,
              health: clamp(player.health - Math.round(hours * 0.8), 0, 100),
              mental: clamp(player.mental + clamp(Math.round(z * 3), -10, 4) - 2, 0, 100),
            },
          });
        },

        leaveFloor: () => {
          const { today, player } = get();
          if (!today) return;
          const parlor = getParlor(today.parlorId);
          const log = makeLog(player.currentDate, 'REST', parlor.name, '—', null, null, `抽選${today.lotteryNumber}番/${today.queueSize}人。座る台がなく帰宅。`);
          useLogStore.getState().append(log);
          set({ phase: 'LEDGER', lastLog: log, player: { ...player, mental: clamp(player.mental - 4, 0, 100) } });
        },

        nightAction: (action) => {
          const { player, traitId, seenEventIds } = get();
          const a = NIGHT_ACTIONS[action];
          const trait = getTrait(traitId ?? '');
          const nextDate = addDays(player.currentDate, 1);
          const notices: string[] = [];
          let cash = player.cash - a.cost;
          if (parseDate(nextDate).getDate() === 1) {
            cash -= MONTHLY_FIXED_COST;
            notices.push(`月初の引き落とし。家賃・光熱費・国保年金で ${MONTHLY_FIXED_COST.toLocaleString()}円が消えた。`);
            if (trait.monthlyDelta !== 0) {
              cash += trait.monthlyDelta;
              notices.push(
                trait.monthlyDelta > 0
                  ? `実家から ${trait.monthlyDelta.toLocaleString()}円が振り込まれていた。`
                  : `借金の返済で ${(-trait.monthlyDelta).toLocaleString()}円が引き落とされた。`,
              );
            }
          }
          const next: PlayerStats = {
            ...player,
            cash,
            currentDate: nextDate,
            health: clamp(player.health + a.health + SLEEP_RECOVERY.health, 0, 100),
            mental: clamp(player.mental + a.mental + SLEEP_RECOVERY.mental, 0, 100),
            socialCredit: clamp(player.socialCredit + a.social, 0, 100),
            hallMark: clamp(player.hallMark - 1, 0, 100),
          };

          const reason = endReason(next);
          if (reason) {
            finishRun(next, reason);
            return;
          }
          const eventId = rollEvent(next, seenEventIds);
          set({
            player: next,
            phase: 'MORNING',
            today: null,
            notices,
            pendingEventId: eventId,
            seenEventIds: eventId ? [...seenEventIds, eventId] : seenEventIds,
            pendingNews: [...get().pendingNews, ...newsBetween(player.currentDate, nextDate)],
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
      version: 2,
      // v1 は出自・イベントの概念がない。進行中のセーブは「元SE」として続行させる
      migrate: (persisted, version) => {
        const s = persisted as Partial<GameState>;
        if (version < 2) {
          return { ...s, traitId: s.traitId ?? 'ex_se', pendingEventId: null, seenEventIds: [] } as GameState;
        }
        return s as GameState;
      },
    },
  ),
);
