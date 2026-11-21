import { getEnvironment } from '../data/eras';
import { counterFlags, getMachine } from '../data/machines';
import { getParlor } from '../data/parlors';
import type { DayLog, FloorUnit, PlaySession, WorkStyle } from '../types';
import { clockLabel } from '../utils/format';
import { clamp, pickWeighted } from '../utils/math';
import { applyLottery, drawLotteryNumber, generateFloor, isEventDay, rollQueue, settingWeights } from './floor';
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
  parlorId: string;
  style: WorkStyle;
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
}

/** 前日データの見た目（ボーナス合算の良さ）で台を選ぶ。勘の良い人は店の意図も少し読める */
function pickUnit(free: FloorUnit[], autoJudge: boolean): FloorUnit {
  const weights = free.map((u) => {
    const m = getMachine(u.machineId);
    const hits = counterFlags(m).reduce((a, f) => a + (u.yesterday.counts[f.key] ?? 0), 0);
    const rate = hits / Math.max(1, u.yesterday.games);
    return Math.max(0.01, rate * 1000) ** 2 * (autoJudge ? 1 + (u.setting - 3.5) * 0.25 : 1);
  });
  return pickWeighted(free, weights);
}

/** 台移動した日の記録を1行にまとめる（記帳上の機種・推定設定は最後に座った台） */
function mergeLogs(logs: DayLog[], memo: string): DayLog {
  const last = logs[logs.length - 1];
  return {
    ...last,
    gamesPlayed: logs.reduce((a, l) => a + l.gamesPlayed, 0),
    expectedValue: logs.reduce((a, l) => a + l.expectedValue, 0),
    actualProfit: logs.reduce((a, l) => a + l.actualProfit, 0),
    sigma: Math.sqrt(logs.reduce((a, l) => a + l.sigma ** 2, 0)),
    cashInvested: logs.reduce((a, l) => a + l.cashInvested, 0),
    trueExpectedValue: logs.reduce((a, l) => a + l.trueExpectedValue, 0),
    memo: [...logs.flatMap((l) => (l.memo ? [l.memo] : [])), memo].join(' / '),
  };
}

/**
 * おまかせ稼働の1日。
 * 設定狙いは、一定ゲーム数ごとに「店の普段の設定配分」を事前分布にした判別で設定4以上の可能性を見積もり、
 * 低ければ見切って別の空き台へ移る（最大3台）。確定演出で高設定が確定したら閉店まで粘る。
 * 台が取れなければハイエナに切り替える。
 * ※ 見切りの判断に使う事前分布は、記帳する推定期待値（一様事前分布）とは別物。
 */
export function autoDay({ date, parlorId, style, hallMark, autoJudge, thickSkin }: AutoDayInput): AutoDayResult {
  const parlor = getParlor(parlorId);
  const env = getEnvironment(date);
  const eventDay = isEventDay(parlor, date);
  const queue = rollQueue(parlor, env, eventDay);
  const lottery = drawLotteryNumber(queue);
  const floor = applyLottery(generateFloor(parlor, env, date, eventDay), lottery, env);
  const entry = OPEN_TIME + Math.floor(lottery / 30);
  const free = floor.filter((u) => u.takenBy === 'NONE');

  const prior = settingWeights(parlor, env, eventDay);
  const firstCheck = autoJudge ? 1500 : 2000;
  const threshold = autoJudge ? 0.3 : 0.2;

  const sessionLogs: DayLog[] = [];
  const highlights: string[] = [];
  let clock = entry;
  let hoursPlayed = 0;
  let isHyena = false;

  if (style === 'SETTING' && free.length > 0) {
    const candidates = [...free];
    let moves = 0;
    while (clock < CLOSE_TIME && candidates.length > 0 && moves < MAX_UNITS_PER_DAY) {
      const unit = pickUnit(candidates, autoJudge);
      candidates.splice(candidates.indexOf(unit), 1);
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
      hoursPlayed += (session.clock - clock) / 60;
      clock = session.clock;
      moves++;
      if (!quit) break;
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
  };
}
