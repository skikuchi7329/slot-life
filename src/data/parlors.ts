import type { Parlor } from '../types';

export const PARLORS: Parlor[] = [
  {
    id: 'esperanza',
    name: 'メガホール エスペランサ駅前',
    kind: 'BIG_EVENT',
    description: '1000台級の大型店。7のつく日は旧イベント日。抽選は数百人規模。',
    unitCount: 40,
    baseQueue: 160,
    normalWeights: [55, 25, 10, 5, 3, 2],
    eventWeights: [22, 16, 14, 18, 14, 16],
    isEventDay: (d) => d.getDate() % 10 === 7,
    carryOverRate: 0.3,
  },
  {
    id: 'showa_dori',
    name: 'パーラー昭和通り',
    kind: 'MID_QUIET',
    description: '常連の老人とタバコの煙。店長は設定をほとんど触らない。並びは数人。',
    unitCount: 24,
    baseQueue: 6,
    normalWeights: [42, 30, 14, 8, 4, 2],
    eventWeights: [42, 30, 14, 8, 4, 2],
    isEventDay: () => false,
    carryOverRate: 0.65,
  },
  {
    id: 'zero_one',
    name: 'スロット専門 ZERO-ONE',
    kind: 'SPECIAL_DAY',
    description: 'ゾロ目（11日・22日）と月初1日が「強い日」。常連と軍団が睨み合う。',
    unitCount: 36,
    baseQueue: 50,
    normalWeights: [50, 28, 12, 5, 3, 2],
    eventWeights: [12, 12, 16, 24, 18, 18],
    isEventDay: (d) => [1, 11, 22].includes(d.getDate()),
    carryOverRate: 0.4,
  },
];

export function getParlor(id: string): Parlor {
  const p = PARLORS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown parlor: ${id}`);
  return p;
}
