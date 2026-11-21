import { getEnvironment } from '../data/eras';
import { getMachine } from '../data/machines';
import type { ActionType, DayLog, Machine, PlaySession } from '../types';
import { clockLabel, signedCoins } from '../utils/format';
import { sampleNormal } from '../utils/math';
import { COINS_PER_1000_YEN, coinsToYen, estimateFromCounters, simulateGames } from './simulation';

export const OPEN_TIME = 10 * 60;
export const CLOSE_TIME = 22 * 60 + 45;

/** ハイエナ1時間あたりの差枚の標準偏差（拾った台の当否で大きくぶれる） */
const HYENA_SD_PER_HOUR = 550;

export function newSession(
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

/** 1時間（閉店間際は残り時間）だけ遊技を進める */
export function advanceSession(session: PlaySession, hallMark: number, date: string): PlaySession {
  const env = getEnvironment(date);
  const minutes = Math.min(60, CLOSE_TIME - session.clock);
  if (minutes <= 0) return session;

  if (session.actionType === 'HYENA') {
    const hours = minutes / 60;
    // 店にマークされるほど、良い台の前に立つ前に店員が来る
    const mean = env.hyenaCoinsPerHour * Math.max(0.2, 1 - hallMark / 125) * hours;
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
  const games = Math.round((machine.gamesPerHour * minutes) / 60);
  const r = simulateGames(machine, session.unitSetting!, games);
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

/** プレミア・確定演出など、記録に残す出来事 */
export function notableEvents(machine: Machine, counts: Record<string, number>): string[] {
  return machine.flags
    .filter((f) => (counts[f.key] ?? 0) > 0 && (f.kind === 'PREMIUM' || f.style === 'CONFIRM'))
    .map((f) => (f.kind === 'PREMIUM' ? `${f.label}を引いた` : `${f.label}（${f.meaning}）`));
}

export function makeLog(
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
  const machine = session?.machineId ? getMachine(session.machineId) : null;
  // 設定狙いは小役カウンター・示唆からの推定でしか期待値を知り得ない。ハイエナは天井・ゾーンの期待値が既知
  const estimate = machine && session && session.games > 0 ? estimateFromCounters(machine, session.games, session.counts) : null;
  const estCoins = estimate?.expectedCoins ?? session?.expectedCoins ?? 0;
  const estVariance = estimate?.variance ?? session?.coinVariance ?? 0;
  const notable = machine && session ? notableEvents(machine, session.counts) : [];
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
    memo: [...notable, memo].filter(Boolean).join(' / '),
  };
}
