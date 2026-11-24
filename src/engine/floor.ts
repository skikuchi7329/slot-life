import { counterFlags, getMachine, machinesAvailableOn, MACHINES } from '../data/machines';
import type { CounterData, DaySnapshot, Environment, FloorUnit, ParlorNotice, ParlorProfile, Placement } from '../types';
import { addDays, parseDate } from '../utils/format';
import { clamp, pickWeighted, randInt, seeded } from '../utils/math';
import { OPEN_TIME, CLOSE_TIME } from './session';
import { simulateGames } from './simulation';

/** 並び客のうち、スロットの対象島に向かう割合 */
const SLOT_TARGET_SHARE = 0.35;

const lowSetting = () => pickWeighted([1, 2, 3], [45, 32, 23]);
const highSetting = () => pickWeighted([4, 5, 6], [40, 32, 28]);

// ============================================================
// 島の構成（四半期ごとに固定。「#115はハーデス」と覚えられる）
// ============================================================

function quarterKey(iso: string): string {
  const d = parseDate(iso);
  return `${d.getFullYear()}Q${Math.floor(d.getMonth() / 3)}`;
}

export function layoutFor(parlor: ParlorProfile, iso: string): string[] {
  const machines = machinesAvailableOn(iso);
  const key = `${parlor.id}-${quarterKey(iso)}`;
  const ids: string[] = [];
  for (let i = 0; i < parlor.unitCount; i++) {
    const r = seeded(key, i);
    const total = machines.reduce((a, m) => a + m.shareWeight, 0);
    let acc = r * total;
    const m = machines.find((x) => (acc -= x.shareWeight) <= 0) ?? machines[machines.length - 1];
    ids.push(m.id);
  }
  // 機種ごとにまとめて島を作る
  const order = machines.map((m) => m.id);
  return ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** 機種の塊の両端＝角台 */
function cornerFlags(ids: string[]): boolean[] {
  return ids.map((id, i) => i === 0 || i === ids.length - 1 || ids[i - 1] !== id || ids[i + 1] !== id);
}

// ============================================================
// 強い日と入れ方
// ============================================================

export function isStrongDay(parlor: ParlorProfile, iso: string): boolean {
  const d = parseDate(iso);
  const r = parlor.strongDay;
  switch (r.kind) {
    case 'TAIL':
      return d.getDate() % 10 === r.digit;
    case 'ZOROME':
      return d.getDate() === 11 || d.getDate() === 22;
    case 'WEEKDAY':
      return d.getDay() === r.day;
    case 'MONTH_START':
      return d.getDate() === 1;
    default:
      return false;
  }
}

interface StrongPlan {
  placement: Placement;
  machineId?: string;
  digit?: number;
  lineStart?: number;
  lineLength?: number;
}

/** 強い日の具体的な入れ方（日付から決まるので、告知と実際の設定が食い違わない） */
function strongPlan(parlor: ParlorProfile, iso: string, ids: string[]): StrongPlan {
  const key = `${parlor.id}-${iso}-plan`;
  switch (parlor.placement) {
    case 'ALL_MODEL': {
      const models = [...new Set(ids)].filter((id) => ids.filter((x) => x === id).length >= 3);
      return { placement: 'ALL_MODEL', machineId: models[Math.floor(seeded(key, 1) * models.length)] ?? ids[0] };
    }
    case 'LINE': {
      const lineLength = 4 + Math.floor(seeded(key, 2) * 2);
      return { placement: 'LINE', lineStart: Math.floor(seeded(key, 3) * (ids.length - lineLength)), lineLength };
    }
    case 'TAIL_NUMBER':
      return { placement: 'TAIL_NUMBER', digit: parseDate(iso).getDate() % 10 };
    default:
      return { placement: parlor.placement };
  }
}

function inPlan(plan: StrongPlan, i: number, unitNo: number, id: string, corner: boolean): boolean {
  switch (plan.placement) {
    case 'ALL_MODEL':
      return id === plan.machineId;
    case 'LINE':
      return i >= plan.lineStart! && i < plan.lineStart! + plan.lineLength!;
    case 'TAIL_NUMBER':
      return unitNo % 10 === plan.digit;
    case 'CORNER':
      return corner;
    default:
      return false;
  }
}

/**
 * 1日分の設定を決める。
 * 前日の据え置き → 強い日の入れ方 → 通常日の散らし → 凹み上げ、の順に適用する。
 */
function assignSettings(parlor: ParlorProfile, env: Environment, iso: string, ids: string[], prev: number[] | null, prevDiff: number[] | null): number[] {
  const corners = cornerFlags(ids);
  const strong = isStrongDay(parlor, iso);
  // 告知禁止後も店は「匂わせ」で続けるが、投入量は落ちる
  const strength = env.eventsAllowed ? 1 : 0.65;
  const gen = env.generosity ** 2;
  const plan = strong ? strongPlan(parlor, iso, ids) : null;
  const worst = prevDiff
    ? prevDiff
        .map((d, i) => [d, i])
        .sort((a, b) => a[0] - b[0])
        .slice(0, 2)
        .map(([, i]) => i)
    : [];

  return ids.map((id, i) => {
    const unitNo = 101 + i;
    if (prev && Math.random() < parlor.carryOverRate) return prev[i];
    let pHigh = parlor.normalHighRate * gen;
    if (plan) {
      if (plan.placement === 'SCATTER') pHigh = Math.max(pHigh, parlor.strongHighRate * strength * gen);
      else if (inPlan(plan, i, unitNo, id, corners[i])) pHigh = 0.9 * strength;
    }
    if (parlor.dentedRaise && worst.includes(i)) pHigh = Math.max(pHigh, 0.6);
    return Math.random() < clamp(pHigh, 0, 1) ? highSetting() : lowSetting();
  });
}

// ============================================================
// 告知・匂わせ
// ============================================================

const PLACEMENTS: Placement[] = ['ALL_MODEL', 'LINE', 'TAIL_NUMBER', 'CORNER', 'SCATTER'];

function noticeMedium(iso: string, env: Environment, key: string): string {
  if (env.eventsAllowed) return '店内告知';
  if (iso >= '2014-01-01' && seeded(key, 9) < 0.3) return '取材';
  if (iso >= '2023-07-24') return 'X';
  if (iso >= '2013-01-01') return 'Twitter';
  return 'ブログ';
}

function noticeText(p: Placement, explicit: boolean, machineName?: string, digit?: number): string {
  switch (p) {
    case 'ALL_MODEL':
      return explicit ? `「${machineName}」全台系！` : `明日は「${machineName}」に注目…`;
    case 'LINE':
      return explicit ? '並び設定あり！' : '並びで見ていただけると…';
    case 'TAIL_NUMBER':
      return explicit ? `末尾${digit}番台に設定投入！` : `末尾${digit}に愛を`;
    case 'CORNER':
      return explicit ? '角台に高設定！' : '角に期待してください';
    default:
      return explicit ? '全台高設定チャンス！' : '全体的に頑張ります';
  }
}

/**
 * その日の告知。強い日は（正直な店なら）本当の入れ方を示し、嘘つきの店は別の入れ方を言う。
 * 強くない日にも、煽るだけの告知を出す店がある。
 */
export function noticeFor(parlor: ParlorProfile, env: Environment, iso: string): ParlorNotice | null {
  const key = `${parlor.id}-${iso}-notice`;
  const strong = isStrongDay(parlor, iso);
  const ids = layoutFor(parlor, iso);
  let placement: Placement;
  let machineId: string | undefined;
  let digit: number | undefined;
  if (strong) {
    if (seeded(key, 1) > 0.85) return null;
    const plan = strongPlan(parlor, iso, ids);
    if (seeded(key, 2) < parlor.honesty) {
      ({ placement, machineId, digit } = plan);
    } else {
      placement = PLACEMENTS.filter((x) => x !== plan.placement)[Math.floor(seeded(key, 3) * 4)];
    }
  } else {
    if (seeded(key, 4) > (1 - parlor.honesty) * 0.25) return null;
    placement = PLACEMENTS[Math.floor(seeded(key, 5) * PLACEMENTS.length)];
  }
  if (placement === 'ALL_MODEL' && !machineId) machineId = ids[Math.floor(seeded(key, 6) * ids.length)];
  if (placement === 'TAIL_NUMBER' && digit === undefined) digit = parseDate(iso).getDate() % 10;
  const medium = noticeMedium(iso, env, key);
  const machineName = machineId ? getMachine(machineId).name : undefined;
  const text = medium === '取材' ? `来店取材「スロ番長の実戦録」 ${noticeText(placement, false, machineName, digit)}` : noticeText(placement, env.eventsAllowed, machineName, digit);
  return { medium, text, placement, machineId, digit };
}

// ============================================================
// 島の生成
// ============================================================

/** 他の客がいつ席を立つか。高設定ほど閉店まで粘られる */
function quitTimeFor(setting: number, start: number): number {
  if (setting >= 4 && Math.random() < 0.75) return CLOSE_TIME;
  const hours = setting >= 4 ? randInt(4, 10) : randInt(1, 7);
  return Math.min(CLOSE_TIME, start + hours * 60 + randInt(0, 59));
}

function playedData(machineId: string, setting: number, start: number, end: number): CounterData {
  const machine = getMachine(machineId);
  const games = Math.max(0, Math.round(((end - start) / 60) * machine.gamesPerHour));
  if (games === 0) return { games: 0, counts: {}, coinDiff: 0 };
  const r = simulateGames(machine, setting, games);
  return { games, counts: r.counts, coinDiff: r.coinDiff };
}

export interface FloorResult {
  floor: FloorUnit[];
  notice: ParlorNotice | null;
}

export function generateFloor(parlor: ParlorProfile, env: Environment, iso: string): FloorResult {
  const ids = layoutFor(parlor, iso);
  const corners = cornerFlags(ids);
  const yIso = addDays(iso, -1);
  const ySettings = assignSettings(parlor, env, yIso, ids, null, null);
  const yesterday = ids.map((id, i) => {
    const end = ySettings[i] >= 4 ? CLOSE_TIME : quitTimeFor(ySettings[i], OPEN_TIME);
    return playedData(id, ySettings[i], OPEN_TIME, Math.max(end, OPEN_TIME + 120));
  });
  const settings = assignSettings(
    parlor,
    env,
    iso,
    ids,
    ySettings,
    yesterday.map((y) => y.coinDiff),
  );
  const floor = ids.map<FloorUnit>((machineId, i) => ({
    unitNo: 101 + i,
    machineId,
    setting: settings[i],
    corner: corners[i],
    yesterday: yesterday[i],
    takenBy: 'NONE',
    closing: { games: 0, counts: {}, coinDiff: 0 },
    quitAt: OPEN_TIME,
  }));
  return { floor, notice: noticeFor(parlor, env, iso) };
}

export function rollQueue(parlor: ParlorProfile, env: Environment, notice: ParlorNotice | null): number {
  // 告知が出た日は、嘘でも人が集まる
  const mult = (notice ? 2.5 : 1) * (1 + env.crowdPressure);
  return Math.max(1, Math.round(parlor.baseQueue * mult * (0.8 + Math.random() * 0.4)));
}

export function drawLotteryNumber(queueSize: number): number {
  return randInt(1, queueSize);
}

/** 告知の入れ方に合う台か */
export function matchesNotice(notice: ParlorNotice | null, u: FloorUnit): boolean {
  if (!notice) return false;
  switch (notice.placement) {
    case 'ALL_MODEL':
      return u.machineId === notice.machineId;
    case 'TAIL_NUMBER':
      return u.unitNo % 10 === notice.digit;
    case 'CORNER':
      return u.corner;
    default:
      return false;
  }
}

/**
 * 抽選番号より前の客が台を取っていく。
 * 軍団・設定師（crowdPressure、癒着店ではさらに多い）は高設定を正確に先取りし、
 * 一般客は告知に合う台や前日の凹み台に座る。取られた台は、各客の打ち方に従って途中で空く。
 */
export function applyLottery(floor: FloorUnit[], lotteryNumber: number, env: Environment, parlor: ParlorProfile, notice: ParlorNotice | null): FloorUnit[] {
  const result = floor.map((u) => ({ ...u }));
  const takers = Math.min(result.length, Math.round((lotteryNumber - 1) * SLOT_TARGET_SHARE));
  const informedRate = clamp(env.crowdPressure + (parlor.gundanTie ? 0.3 : 0), 0, 0.95);
  for (let i = 0; i < takers; i++) {
    const free = result.filter((u) => u.takenBy === 'NONE');
    if (free.length === 0) break;
    const target =
      Math.random() < informedRate
        ? pickWeighted(free, free.map((u) => u.setting ** 3))
        : pickWeighted(free, free.map((u) => (matchesNotice(notice, u) ? 4 : 1) * (u.yesterday.coinDiff < -1000 ? 2 : 1)));
    target.takenBy = 'OTHER';
    const start = OPEN_TIME + randInt(0, 20);
    target.quitAt = quitTimeFor(target.setting, start);
    target.closing = playedData(target.machineId, target.setting, start, target.quitAt);
  }
  return result;
}

/** 時刻 t に空いている台か（最初から空き、または他の客が席を立った後） */
export function isFree(u: FloorUnit, t: number): boolean {
  return u.takenBy === 'NONE' || (u.takenBy === 'OTHER' && t >= u.quitAt);
}

/** 時刻 t にデータカウンターで見える当日のデータ */
export function currentData(u: FloorUnit, t: number): CounterData {
  if (u.takenBy !== 'OTHER' || t >= u.quitAt) return u.closing;
  const frac = clamp((t - OPEN_TIME) / Math.max(1, u.quitAt - OPEN_TIME), 0, 1);
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(u.closing.counts)) counts[k] = Math.round(v * frac);
  return { games: Math.round(u.closing.games * frac), counts, coinDiff: Math.round(u.closing.coinDiff * frac) };
}

/** 閉店後のデータ。プレイヤーの台は自分のデータで上書きする */
export function snapshotOf(iso: string, floor: FloorUnit[], notice: ParlorNotice | null, own?: { unitNo: number; data: CounterData }[]): DaySnapshot {
  return {
    date: iso,
    notice: notice ? `［${notice.medium}］${notice.text}` : null,
    units: floor.map((u) => {
      const d = own?.find((o) => o.unitNo === u.unitNo)?.data ?? u.closing;
      const [f1, f2] = counterFlags(getMachine(u.machineId));
      return [u.unitNo, MACHINES.findIndex((m) => m.id === u.machineId), d.games, f1 ? (d.counts[f1.key] ?? 0) : 0, f2 ? (d.counts[f2.key] ?? 0) : 0, d.coinDiff];
    }),
  };
}

/** 店の普段の設定配分（おまかせの見切りの事前分布） */
export function settingPrior(parlor: ParlorProfile, env: Environment, strong: boolean): number[] {
  const high = clamp((strong ? parlor.strongHighRate : parlor.normalHighRate) * env.generosity ** 2, 0.02, 0.9);
  const low = [45, 32, 23].map((w) => (w / 100) * (1 - high));
  const hi = [40, 32, 28].map((w) => (w / 100) * high);
  return [...low, ...hi];
}
