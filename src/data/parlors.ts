import type { ParlorProfile, ParlorSize, Placement, StrongDayRule } from '../types';
import { pickWeighted, randInt } from '../utils/math';

// 店は人生ごとにランダムに生成する。癖はプレイヤーに見えず、告知と閉店後のデータから推理する。

const NAME_POOL: Record<ParlorSize, string[]> = {
  BIG: ['メガホール エスペランサ駅前', 'グランドパレス777', 'ZENITH 国道店', 'キングダム1000'],
  MID: ['スロット専門 ZERO-ONE', 'パーラー銀河', 'スロットクラブ ネオン', 'アミューズ ルナ'],
  SMALL: ['パーラー昭和通り', 'ホール大黒', '遊技場みどり', 'パーラー富士'],
};

const DESCRIPTION: Record<ParlorSize, string[]> = {
  BIG: ['1000台級の大型店。告知は派手で、抽選は数百人規模。', '駅前の大型店。土日は軍団らしき集団が並ぶ。'],
  MID: ['スロット専門の中型店。特定日には常連が殺気立つ。', '中型店。店長が替わったばかりだという噂。'],
  SMALL: ['常連の老人とタバコの煙。並びは数人。', '古い小さな店。店長は設定をほとんど触らないらしい。'],
};

const PLACEMENT_WEIGHTS: Record<ParlorSize, [Placement[], number[]]> = {
  BIG: [['ALL_MODEL', 'LINE', 'TAIL_NUMBER', 'CORNER', 'SCATTER'], [3, 2, 2, 1, 1]],
  MID: [['ALL_MODEL', 'LINE', 'TAIL_NUMBER', 'CORNER', 'SCATTER'], [2, 2, 2, 2, 1]],
  SMALL: [['LINE', 'CORNER', 'SCATTER'], [1, 2, 3]],
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function strongDayFor(size: ParlorSize): StrongDayRule {
  if (size === 'SMALL' && Math.random() < 0.5) return { kind: 'NONE' };
  return pickWeighted<StrongDayRule>(
    [
      { kind: 'TAIL', digit: pickWeighted([7, 0, 5, 3, 8], [4, 2, 2, 1, 1]) },
      { kind: 'ZOROME' },
      { kind: 'WEEKDAY', day: pickWeighted([6, 0, 2, 4], [2, 1, 1, 1]) },
      { kind: 'MONTH_START' },
    ],
    [5, 2, 2, 1],
  );
}

function makeParlor(size: ParlorSize, name: string, index: number): ParlorProfile {
  const [placements, weights] = PLACEMENT_WEIGHTS[size];
  const descriptions = DESCRIPTION[size];
  const base = {
    BIG: { unitCount: 40, queue: randInt(120, 200), normal: rand(0.04, 0.08), strong: rand(0.35, 0.6), carry: rand(0.2, 0.4) },
    MID: { unitCount: 36, queue: randInt(30, 70), normal: rand(0.05, 0.1), strong: rand(0.3, 0.55), carry: rand(0.3, 0.5) },
    SMALL: { unitCount: 24, queue: randInt(4, 12), normal: rand(0.1, 0.16), strong: rand(0.2, 0.35), carry: rand(0.5, 0.75) },
  }[size];
  return {
    id: `p${index}`,
    name,
    size,
    description: descriptions[randInt(0, descriptions.length - 1)],
    unitCount: base.unitCount,
    baseQueue: base.queue,
    normalHighRate: base.normal,
    strongDay: strongDayFor(size),
    strongHighRate: base.strong,
    placement: pickWeighted(placements, weights),
    carryOverRate: base.carry,
    dentedRaise: Math.random() < 0.35,
    honesty: rand(0.3, 0.95),
    gundanTie: size !== 'SMALL' && Math.random() < 0.35,
  };
}

/** 新しい人生の街。大型2・中型2・小型2の6軒 */
export function generateParlors(): ParlorProfile[] {
  const sizes: ParlorSize[] = ['BIG', 'BIG', 'MID', 'MID', 'SMALL', 'SMALL'];
  const used = new Set<string>();
  return sizes.map((size, i) => {
    const pool = NAME_POOL[size].filter((n) => !used.has(n));
    const name = pool[randInt(0, pool.length - 1)];
    used.add(name);
    return makeParlor(size, name, i);
  });
}

const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

/** 前世の記憶「店の癖」で見える、店の本当の性格 */
export function describeHabit(p: ParlorProfile): string {
  const rule = p.strongDay;
  const day =
    rule.kind === 'TAIL'
      ? `${rule.digit}のつく日`
      : rule.kind === 'ZOROME'
        ? 'ゾロ目の日'
        : rule.kind === 'WEEKDAY'
          ? `${WEEKDAY_NAMES[rule.day]}曜日`
          : rule.kind === 'MONTH_START'
            ? '月初1日'
            : '強い日なし';
  const placement = { ALL_MODEL: '全台系', LINE: '並び', TAIL_NUMBER: '末尾', CORNER: '角台', SCATTER: 'バラ' }[p.placement];
  return `${day}に${placement}・据え置き${Math.round(p.carryOverRate * 100)}%・告知${p.honesty > 0.7 ? '正直' : p.honesty > 0.45 ? '半々' : '煽り'}${p.gundanTie ? '・軍団' : ''}${p.dentedRaise ? '・凹み上げ' : ''}`;
}
