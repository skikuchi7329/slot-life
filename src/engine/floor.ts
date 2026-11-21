import { machinesAvailableOn, getMachine } from '../data/machines';
import type { Environment, FloorUnit, Parlor } from '../types';
import { clamp, pickWeighted, randInt } from '../utils/math';
import { parseDate } from '../utils/format';
import { simulateGames } from './simulation';

const SETTINGS = [1, 2, 3, 4, 5, 6] as const;

/** 並び客のうち、スロットの対象島に向かう割合 */
const SLOT_TARGET_SHARE = 0.35;

export function settingWeights(parlor: Parlor, env: Environment, eventDay: boolean): number[] {
  let weights: number[] = parlor.normalWeights;
  if (eventDay) {
    // 告知禁止後も店は「匂わせ」で続けるが、投入量は半分程度に落ちる
    const blend = env.eventsAllowed ? 1 : 0.5;
    weights = parlor.eventWeights.map((w, i) => parlor.normalWeights[i] * (1 - blend) + w * blend);
  }
  // 甘さ係数で高設定側を持ち上げる／沈める
  return weights.map((w, i) => w * env.generosity ** (SETTINGS[i] - 3.5));
}

function simulateYesterday(machineId: string, setting: number): FloorUnit['yesterday'] {
  const machine = getMachine(machineId);
  // 高設定ほど閉店まで回される
  const games = clamp(Math.round(1500 + Math.random() * 5000 + (setting - 1) * 500), 300, 9000);
  const r = simulateGames(machine, setting, games);
  return { games, counts: r.counts, coinDiff: r.coinDiff };
}

export function generateFloor(parlor: Parlor, env: Environment, iso: string, eventDay: boolean): FloorUnit[] {
  const machines = machinesAvailableOn(iso);
  const weights = settingWeights(parlor, env, eventDay);
  const yesterdayWeights = settingWeights(parlor, env, false);
  const shares = machines.map((m) => m.shareWeight);

  // 機種ごとにまとめて島を作る
  const machineIds = Array.from({ length: parlor.unitCount }, () => pickWeighted(machines, shares).id).sort(
    (a, b) => machines.findIndex((m) => m.id === a) - machines.findIndex((m) => m.id === b),
  );

  return machineIds.map((machineId, i) => {
    const setting = pickWeighted(SETTINGS, weights);
    const ySetting = Math.random() < parlor.carryOverRate ? setting : pickWeighted(SETTINGS, yesterdayWeights);
    return {
      unitNo: 101 + i,
      machineId,
      setting,
      yesterday: simulateYesterday(machineId, ySetting),
      takenBy: 'NONE',
    };
  });
}

export function rollQueue(parlor: Parlor, env: Environment, eventDay: boolean): number {
  const mult = (eventDay ? 2.5 : 1) * (1 + env.crowdPressure);
  return Math.max(1, Math.round(parlor.baseQueue * mult * (0.8 + Math.random() * 0.4)));
}

/**
 * 抽選番号より前の客が台を取っていく。
 * 軍団・設定師（crowdPressure）が多い時代ほど、高設定が正確に先取りされる。
 */
export function applyLottery(floor: FloorUnit[], lotteryNumber: number, env: Environment): FloorUnit[] {
  const result = floor.map((u) => ({ ...u }));
  const takers = Math.min(result.length, Math.round((lotteryNumber - 1) * SLOT_TARGET_SHARE));
  for (let i = 0; i < takers; i++) {
    const free = result.filter((u) => u.takenBy === 'NONE');
    if (free.length === 0) break;
    const informed = Math.random() < env.crowdPressure;
    const target = informed
      ? pickWeighted(free, free.map((u) => u.setting ** 3))
      : // 一般客は前日の凹み台やランダムに座る
        pickWeighted(free, free.map((u) => (u.yesterday.coinDiff < -1000 ? 2 : 1)));
    target.takenBy = 'OTHER';
  }
  return result;
}

export function drawLotteryNumber(queueSize: number): number {
  return randInt(1, queueSize);
}

export function isEventDay(parlor: Parlor, iso: string): boolean {
  return parlor.isEventDay(parseDate(iso));
}
