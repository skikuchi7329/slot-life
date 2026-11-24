import { getEnvironment } from '../data/eras';
import { counterFlags, getMachine } from '../data/machines';
import type { DayLog, DaySnapshot, FloorUnit, Gear, ParlorNotice, ParlorProfile, PickRule, PlaySession, RunnerOrder, WorkStyle } from '../types';
import { parseDate } from '../utils/format';
import { clockLabel } from '../utils/format';
import { clamp, pickWeighted } from '../utils/math';
import { applyLottery, drawLotteryNumbers, generateFloor, isFree, isStrongDay, matchesNotice, rollQueue, settingPrior, snapshotOf } from './floor';
import { advanceSession, CLOSE_TIME, makeLog, newSession, notableEvents, OPEN_TIME } from './session';
import { settingPosterior } from './simulation';

/** ハイエナ1時間ごとの店マーク上昇 */
export const HYENA_MARK_PER_HOUR = 1;

/** 台移動の上限（1日に座る台の数） */
const MAX_UNITS_PER_DAY = 3;

/**
 * 1日の稼働による心身の消耗。
 * 体力は稼働時間に比例して削れ、精神は「期待値からの乖離（σ単位）」で削れる。勝っても期待値以下なら虚しい。
 * クッション・イヤホンがあれば少しだけ和らぐ
 */
export function dayStrain(log: DayLog, hoursPlayed: number, thickSkin: boolean, gear?: Gear): { health: number; mental: number } {
  const z = log.sigma > 0 ? (log.actualProfit - log.expectedValue) / log.sigma : 0;
  return {
    health: -Math.max(0, 2 + Math.round(hoursPlayed * 0.8) - (gear?.healthGuard ?? 0)),
    mental: clamp(Math.round(z * 3), thickSkin ? -6 : -10, 4) - 2 + (gear?.mentalGuard ?? 0),
  };
}

/** 道具なしの状態 */
export const NO_GEAR: Gear = { handCounter: true, hyenaBoost: 1, healthGuard: 0, mentalGuard: 0 };

interface AutoDayInput {
  date: string;
  parlor: ParlorProfile;
  style: WorkStyle;
  pickRule: PickRule;
  hallMark: number;
  /** 前世の記憶「見切りの勘」 */
  autoJudge: boolean;
  thickSkin: boolean;
  gear: Gear;
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
 * people は一緒に並ぶ人数（自分＋引き子＋打ち子）。若い番号から自分、打ち子の順に使う
 */
export function simulateParlorDay(parlor: ParlorProfile, date: string, people = 1) {
  const env = getEnvironment(date);
  const { floor: base, notice } = generateFloor(parlor, env, date);
  const queue = rollQueue(parlor, env, notice) + people - 1;
  const lotteries = drawLotteryNumbers(queue, people);
  const lottery = lotteries[0];
  const floor = applyLottery(base, lottery, env, parlor, notice);
  return { env, floor, notice, queue, lottery, lotteries };
}

interface SettingPlay {
  floor: FloorUnit[];
  date: string;
  parlor: ParlorProfile;
  notice: ParlorNotice | null;
  pickRule: PickRule;
  hallMark: number;
  autoJudge: boolean;
  prior: number[];
  handCounter: boolean;
  /** 自分・打ち子が一度座った台（同じ台に戻らない） */
  tried: Set<number>;
}

/**
 * 1台を打つ。判別で設定4以上の可能性が低ければ見切る。
 * 席を立った台は、その時点のデータを残して空き台になる（打ち子・他の客が座れる）
 */
function playOneUnit(ctx: SettingPlay, unit: FloorUnit, start: number, who: string, toClose = false) {
  const { date, parlor, hallMark, autoJudge, prior, handCounter } = ctx;
  const firstCheck = autoJudge ? 1500 : 2000;
  const threshold = autoJudge ? 0.3 : 0.2;
  ctx.tried.add(unit.unitNo);
  const machine = getMachine(unit.machineId);
  let session: PlaySession = newSession(machine.type === 'TECH' ? 'TECH' : 'SETTING', unit.unitNo, unit.machineId, unit.setting, start);
  let quit = false;
  while (session.clock < CLOSE_TIME && !quit) {
    session = advanceSession(session, hallMark, date);
    if (!toClose && session.games >= firstCheck) {
      const p = settingPosterior(machine, session.games, session.counts, prior, handCounter);
      const highConfirmed = p[0] + p[1] + p[2] === 0;
      quit = !highConfirmed && p[3] + p[4] + p[5] < threshold;
    }
  }
  const name = `${machine.name} #${unit.unitNo}`;
  const log = makeLog(date, session.actionType, parlor.name, name, session, unit.setting, quit ? `${who}${clockLabel(session.clock)}見切り` : who, handCounter);
  Object.assign(unit, {
    takenBy: 'OTHER',
    quitAt: session.clock,
    closing: { games: session.games, counts: session.counts, coinDiff: session.coinDiff },
  });
  return { log, highlights: notableEvents(machine, session.counts).map((h) => `${who}${name}で${h}`), clock: session.clock, quit };
}

/** 設定狙いで台を選び、見切ったら別の空き台へ移る（最大 maxUnits 台） */
function playSetting(ctx: SettingPlay, start: number, maxUnits: number) {
  const candidatesAt = (t: number) => ctx.floor.filter((u) => isFree(u, t) && !ctx.tried.has(u.unitNo));
  const logs: DayLog[] = [];
  const highlights: string[] = [];
  let clock = start;
  for (let moves = 0; clock < CLOSE_TIME && moves < maxUnits && candidatesAt(clock).length > 0; moves++) {
    const unit = pickUnit(candidatesAt(clock), ctx.notice, ctx.pickRule, ctx.date, ctx.autoJudge);
    const r = playOneUnit(ctx, unit, clock, '');
    logs.push(r.log);
    highlights.push(...r.highlights);
    clock = r.clock;
    if (!r.quit) break;
  }
  return { logs, highlights, clock };
}

interface RunnerPlayInput {
  floor: FloorUnit[];
  /** 打たせる台。null なら最初からハイエナ */
  unitNo: number | null;
  date: string;
  parlor: ParlorProfile;
  notice: ParlorNotice | null;
  hallMark: number;
  handCounter: boolean;
  start: number;
  order: RunnerOrder;
  /** 攻略誌・有料noteの知識は打ち子にも教える */
  hyenaBoost: number;
}

/** from から閉店までハイエナで巡回する。打ち子は顔が知られていないので、店マークは自分のものを使わない */
function hyenaUntilClose(date: string, parlorName: string, from: number, hallMark: number, hyenaBoost: number, memo: string): DayLog {
  let rest = newSession('HYENA', null, null, null, from);
  while (rest.clock < CLOSE_TIME) rest = advanceSession(rest, hallMark, date, hyenaBoost);
  return makeLog(date, 'HYENA', parlorName, 'ハイエナ巡回', rest, null, memo);
}

/**
 * 勝負日の打ち子。指示された台を、閉店まで打ち切る／見切ったら帰る／見切ったらハイエナ（floor を書き換える）。
 * 見切りの判断はおまかせと同じ（店の普段の設定配分を事前分布にした判別）
 */
export function runnerPlay({ floor, unitNo, date, parlor, notice, hallMark, handCounter, start, order, hyenaBoost }: RunnerPlayInput): DayLog {
  const env = getEnvironment(date);
  if (unitNo === null) return hyenaUntilClose(date, parlor.name, start, 0, hyenaBoost, '打ち子 ハイエナ');
  const unit = floor.find((u) => u.unitNo === unitNo)!;
  const ctx: SettingPlay = {
    floor,
    date,
    parlor,
    notice,
    pickRule: 'NOTICE',
    hallMark,
    autoJudge: false,
    prior: settingPrior(parlor, env, isStrongDay(parlor, date)),
    handCounter,
    tried: new Set<number>(),
  };
  const r = playOneUnit(ctx, unit, start, '打ち子 ', order === 'CLOSE');
  if (!r.quit || order !== 'HYENA' || r.clock >= CLOSE_TIME - 60) return r.log;
  const rest = hyenaUntilClose(date, parlor.name, r.clock, 0, hyenaBoost, `打ち子 ${clockLabel(r.clock)}からハイエナ`);
  return mergeLogs([r.log, rest], '');
}

/**
 * おまかせ稼働の1日。
 * 設定狙いは、一定ゲーム数ごとに「店の普段の設定配分」を事前分布にした判別で設定4以上の可能性を見積もり、
 * 低ければ見切って別の空き台（ヤメ台を含む）へ移る（最大3台）。確定演出で高設定が確定したら閉店まで粘る。
 * 台が取れなければハイエナに切り替える。
 * ※ 見切りの判断に使う事前分布は、記帳する推定期待値（一様事前分布）とは別物。
 */
export function autoDay({ date, parlor, style, pickRule, hallMark, autoJudge, thickSkin, gear }: AutoDayInput): AutoDayResult {
  const { env, floor, notice, lottery } = simulateParlorDay(parlor, date);
  const entry = OPEN_TIME + Math.floor(lottery / 30);
  const ctx: SettingPlay = {
    floor,
    date,
    parlor,
    notice,
    pickRule,
    hallMark,
    autoJudge,
    prior: settingPrior(parlor, env, isStrongDay(parlor, date)),
    handCounter: gear.handCounter,
    tried: new Set<number>(),
  };

  const sessionLogs: DayLog[] = [];
  const highlights: string[] = [];
  let clock = entry;
  let hoursPlayed = 0;
  let isHyena = false;
  const hyenaUntilClose = (from: number, memo: string) => {
    let rest = newSession('HYENA', null, null, null, from);
    while (rest.clock < CLOSE_TIME) rest = advanceSession(rest, hallMark, date, gear.hyenaBoost);
    sessionLogs.push(makeLog(date, 'HYENA', parlor.name, 'ハイエナ巡回', rest, null, memo));
    hoursPlayed += (rest.clock - from) / 60;
    clock = rest.clock;
  };

  if (style === 'SETTING' && floor.some((u) => isFree(u, clock))) {
    const mine = playSetting(ctx, clock, MAX_UNITS_PER_DAY);
    sessionLogs.push(...mine.logs);
    highlights.push(...mine.highlights);
    hoursPlayed += (mine.clock - clock) / 60;
    clock = mine.clock;
    // 見切り続けて座る台がなくなったら、残りの時間はハイエナで拾う
    if (clock < CLOSE_TIME - 120) hyenaUntilClose(clock, `${clockLabel(clock)}からハイエナ`);
  } else {
    isHyena = true;
    hyenaUntilClose(entry, '');
  }

  const memo = isHyena
    ? `おまかせ ${style === 'SETTING' ? `抽選${lottery}番で台が取れずハイエナ` : 'ハイエナ'}`
    : `おまかせ 抽選${lottery}番${sessionLogs.length > 1 ? ` 移動${sessionLogs.length - 1}回` : ''} ${clockLabel(clock)}ヤメ`;
  const log = mergeLogs(sessionLogs, memo);
  const strain = dayStrain(log, hoursPlayed, thickSkin, gear);
  return {
    log,
    health: strain.health,
    mental: strain.mental,
    hallMark: isHyena ? Math.round(hoursPlayed * HYENA_MARK_PER_HOUR) : 0,
    highlights,
    snapshot: snapshotOf(date, floor, notice),
  };
}
