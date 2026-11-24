import { getEnvironment } from '../data/eras';
import { counterFlags, getMachine } from '../data/machines';
import type { FloorEvent, PlaySession, Today } from '../types';
import { randInt } from '../utils/math';
import { settingPosterior } from './simulation';

/**
 * 勝負日に1時間打つごとに判定する、島で起きる出来事。
 * - 隣の客が確定演出を出したまま席を立つ（6確放置）
 * - 島の台が空く（ヤメ台）。データの良い台なら知らせる
 * - 高設定っぽい台を打っていると、軍団に台を売ってくれと言われる
 * - 店員が台番をメモしている（雰囲気のみ）
 */
export function rollFloorEvent(today: Today, session: PlaySession, prevClock: number, date: string): FloorEvent | null {
  const now = session.clock;
  const justQuit = today.floor.filter((u) => u.takenBy === 'OTHER' && u.quitAt > prevClock && u.quitAt <= now);

  // 隣の台（台番±1）が確定演出を出したまま空いた
  if (session.unitNo !== null) {
    for (const u of justQuit.filter((x) => Math.abs(x.unitNo - session.unitNo!) === 1)) {
      const confirm = getMachine(u.machineId).flags.find((f) => f.style === 'CONFIRM' && (u.closing.counts[f.key] ?? 0) > 0);
      if (confirm) return { kind: 'NEIGHBOR_CONFIRM', unitNo: u.unitNo, label: confirm.label, meaning: confirm.meaning ?? '' };
    }
  }

  // データの良いヤメ台
  const good = justQuit
    .map((u) => {
      const hits = counterFlags(getMachine(u.machineId)).reduce((a, f) => a + (u.closing.counts[f.key] ?? 0), 0);
      return { u, rate: hits / Math.max(1, u.closing.games) };
    })
    .filter((x) => x.u.closing.games >= 1500)
    .sort((a, b) => b.rate - a.rate)[0];
  if (good && Math.random() < 0.5) return { kind: 'YAME', unitNo: good.u.unitNo };

  // 軍団からの台売りの打診
  const env = getEnvironment(date);
  if (session.machineId && session.games >= 2000 && env.crowdPressure >= 0.25 && Math.random() < 0.12) {
    const p = settingPosterior(getMachine(session.machineId), session.games, session.counts);
    if (p[3] + p[4] + p[5] > 0.6) {
      return { kind: 'BUYOUT', price: randInt(1, 3) * 10_000 };
    }
  }

  if (Math.random() < 0.04) return { kind: 'STAFF' };
  return null;
}
