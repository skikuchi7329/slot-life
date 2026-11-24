import { getEnvironment } from '../data/eras';
import { counterFlags, getMachine } from '../data/machines';
import type { DayLog, DaySnapshot, FloorUnit, ParlorNotice, ParlorProfile, PickRule, PlaySession, WorkStyle } from '../types';
import { parseDate } from '../utils/format';
import { clockLabel } from '../utils/format';
import { clamp, pickWeighted } from '../utils/math';
import { applyLottery, drawLotteryNumber, generateFloor, isFree, isStrongDay, matchesNotice, rollQueue, settingPrior, snapshotOf } from './floor';
import { advanceSession, CLOSE_TIME, makeLog, newSession, notableEvents, OPEN_TIME } from './session';
import { settingPosterior } from './simulation';

/** ハイエナ1時間ごとの店マーク上昇 */
export const HYENA_MARK_PER_HOUR = 1;

/** 台移動の上限（1日に座る台の数） */
const MAX_UNITS_PER_DAY = 3;

/**
 * 1日の稼働による心身の消耗。
 * 体力は稼働時間に比例して削れ、精神は「期待値からの乖離（σ単位）」で削れる。勝っても期待値以下なら虚しい
 */
export function dayStrain(log: DayLog, hoursPlayed: number, thickSkin: boolean): { health: number; mental: number } {
  const z = log.sigma > 0 ? (log.actualProfit - log.expectedValue) / log.sigma : 0;
  return {
    health: -(2 + Math.round(hoursPlayed * 0.8)),
    mental: clamp(Math.round(z * 3), thickSkin ? -6 : -10, 4) - 2,
  };
}

interface AutoDayInput {
  date: string;
  parlor: ParlorProfile;
  style: WorkStyle;
  pickRule: PickRule;
  hallMark: number;
  /** 前世の記憶「見切りの勘」 */
  autoJudge: boolean;
  thickSkin: boolean;
}

export interface AutoDayResult {
  log: DayLog;
  health: number;
  mental: number;
  hallMark: number;
  highlights: string[];
  snapshot: DaySnapshot;
}

/** 前日のボーナス合算（1000Gあたり） */
function yesterdayRate(u: FloorUnit): number {
  const hits = counterFlags(getMachine(u.machineId)).reduce((a, f) => a + (u.yesterday.counts[f.key] ?? 0), 0);
  return (hits / Math.max(1, u.yesterday.games)) * 1000;
}

/**
 * 狙い方に従って台を選ぶ。告知に合う台はどの狙い方でも少し優先する。勘の良い人は店の意図も少し読める
 */
export function pickUnit(free: FloorUnit[], notice: ParlorNotice | null, rule: PickRule, date: string, autoJudge: boolean): FloorUnit {
  const digit = parseDate(date).getDate() % 10;
  const worst = [...free].sort((a, b) => a.yesterday.coinDiff - b.yesterday.coinDiff).slice(0, 3);
  const weights = free.map((u) => {
    let w = 1;
    if (rule === 'NOTICE') w = matchesNotice(notice, u) ? 10 : Math.max(0.1, yesterdayRate(u)) ** 2;
    if (rule === 'CARRY') w = Math.max(0.01, yesterdayRate(u)) ** 3;
    if (rule === 'DENTED') w = worst.includes(u) ? 10 : 1;
    if (rule === 'CORNER') w = u.corner ? 10 : 1;
    if (rule === 'TAIL') w = u.unitNo % 10 === digit ? 10 : 1;
    if (rule !== 'NOTICE' && matchesNotice(notice, u)) w *= 2;
    return w * (autoJudge ? 1 + (u.setting - 3.5) * 0.25 : 1);
  });
  return pickWeighted(free, weights);
}

/** 台移動した日の記録を1行にまとめる（記帳上の機種・推定設定は最後に座った台） */
export function mergeLogs(logs: DayLog[], memo: string): DayLog {
  const last = logs[logs.length - 1];
  return {
    ...last,
    gamesPlayed: logs.reduce((a, l) => a + l.gamesPlayed, 0),
    expectedValue: logs.reduce((a, l) => a + l.expectedValue, 0),
    actualProfit: logs.reduce((a, l) => a + l.actualProfit, 0),
    sigma: Math.sqrt(logs.reduce((a, l) => a + l.sigma ** 2, 0)),
    cashInvested: logs.reduce((a, l) => a + l.cashInvested, 0),
    trueExpectedValue: logs.reduce((a, l) => a + l.trueExpectedValue, 0),
    memo: [...logs.flatMap((l) => (l.memo ? [l.memo] : [])), memo].filter(Boolean).join(' / '),
  };
}

/**
 * 店の1日をシミュレートする（自分が行かない日のデータサイト用にも使う）。
 */
export function simulateParlorDay(parlor: ParlorProfile, date: string) {
  const env = getEnvironment(date);
  const { floor: base, notice } = generateFloor(parlor, env, date);
  const queue = rollQueue(parlor, env, notice);
  const lottery = drawLotteryNumber(queue);
  const floor = applyLottery(base, lottery, env, parlor, notice);
  return { env, floor, notice, queue, lottery };
}

/**
 * おまかせ稼働の1日。
 * 設定狙いは、一定ゲーム数ごとに「店の普段の設定配分」を事前分布にした判別で設定4以上の可能性を見積もり、
 * 低ければ見切って別の空き台（ヤメ台を含む）へ移る（最大3台）。確定演出で高設定が確定したら閉店まで粘る。
 * 台が取れなければハイエナに切り替える。
 * ※ 見切りの判断に使う事前分布は、記帳する推定期待値（一様事前分布）とは別物。
 */
export function autoDay({ date, parlor, style, pickRule, hallMark, autoJudge, thickSkin }: AutoDayInput): AutoDayResult {
  const { env, floor, notice, lottery } = simulateParlorDay(parlor, date);
  const entry = OPEN_TIME + Math.floor(lottery / 30);
  const prior = settingPrior(parlor, env, isStrongDay(parlor, date));
  const firstCheck = autoJudge ? 1500 : 2000;
  const threshold = autoJudge ? 0.3 : 0.2;

  const sessionLogs: DayLog[] = [];
  const own: { unitNo: number; data: PlaySession }[] = [];
  const highlights: string[] = [];
  let clock = entry;
  let hoursPlayed = 0;
  let isHyena = false;

  const tried = new Set<number>();
  const candidatesAt = (t: number) => floor.filter((u) => isFree(u, t) && !tried.has(u.unitNo));

  if (style === 'SETTING' && candidatesAt(clock).length > 0) {
    let moves = 0;
    while (clock < CLOSE_TIME && candidatesAt(clock).length > 0 && moves < MAX_UNITS_PER_DAY) {
      const unit = pickUnit(candidatesAt(clock), notice, pickRule, date, autoJudge);
      tried.add(unit.unitNo);
      const machine = getMachine(unit.machineId);
      let session: PlaySession = newSession(machine.type === 'TECH' ? 'TECH' : 'SETTING', unit.unitNo, unit.machineId, unit.setting, clock);
      let quit = false;
      while (session.clock < CLOSE_TIME && !quit) {
        session = advanceSession(session, hallMark, date);
        if (session.games >= firstCheck) {
          const p = settingPosterior(machine, session.games, session.counts, prior);
          const highConfirmed = p[0] + p[1] + p[2] === 0;
          quit = !highConfirmed && p[3] + p[4] + p[5] < threshold;
        }
      }
      const name = `${machine.name} #${unit.unitNo}`;
      sessionLogs.push(makeLog(date, session.actionType, parlor.name, name, session, unit.setting, quit ? `${clockLabel(session.clock)}見切り` : ''));
      highlights.push(...notableEvents(machine, session.counts).map((h) => `${name}で${h}`));
      own.push({ unitNo: unit.unitNo, data: session });
      hoursPlayed += (session.clock - clock) / 60;
      clock = session.clock;
      moves++;
      if (!quit) break;
    }
    // 見切り続けて座る台がなくなったら、残りの時間はハイエナで拾う
    if (clock < CLOSE_TIME - 120) {
      let rest = newSession('HYENA', null, null, null, clock);
      while (rest.clock < CLOSE_TIME) rest = advanceSession(rest, hallMark, date);
      sessionLogs.push(makeLog(date, 'HYENA', parlor.name, 'ハイエナ巡回', rest, null, `${clockLabel(clock)}からハイエナ`));
      hoursPlayed += (rest.clock - clock) / 60;
      clock = rest.clock;
    }
  } else {
    isHyena = true;
    let session = newSession('HYENA', null, null, null, entry);
    while (session.clock < CLOSE_TIME) session = advanceSession(session, hallMark, date);
    sessionLogs.push(makeLog(date, 'HYENA', parlor.name, 'ハイエナ巡回', session, null, ''));
    hoursPlayed = (session.clock - entry) / 60;
  }

  const memo = isHyena
    ? `おまかせ ${style === 'SETTING' ? `抽選${lottery}番で台が取れずハイエナ` : 'ハイエナ'}`
    : `おまかせ 抽選${lottery}番${sessionLogs.length > 1 ? ` 移動${sessionLogs.length - 1}回` : ''} ${clockLabel(clock)}ヤメ`;
  const log = mergeLogs(sessionLogs, memo);
  const strain = dayStrain(log, hoursPlayed, thickSkin);
  return {
    log,
    health: strain.health,
    mental: strain.mental,
    hallMark: isHyena ? Math.round(hoursPlayed * HYENA_MARK_PER_HOUR) : 0,
    highlights,
    snapshot: snapshotOf(
      date,
      floor,
      notice,
      own.map((o) => ({ unitNo: o.unitNo, data: { games: o.data.games, counts: o.data.counts, coinDiff: o.data.coinDiff } })),
    ),
  };
}
