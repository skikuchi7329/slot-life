import type { LegacyPerk } from '../types';

/**
 * 前世の記憶。人生をまたいで引き継ぐ知識。
 * リアルさを崩さないよう、効果は「知識（見えるものが増える）」と「小さな下駄」に留める。
 */
export const LEGACY_PERKS: LegacyPerk[] = [
  {
    id: 'HINT_INSIGHT',
    name: '示唆の真偽',
    description: '噂レベルの示唆が、ガセか本物か分かる。',
    cost: 2,
  },
  {
    id: 'PARLOR_HABIT',
    name: '店の癖',
    description: '各店の据え置き傾向と、狙い日の本気度が分かる。',
    cost: 2,
  },
  {
    id: 'AUTO_JUDGE',
    name: '見切りの勘',
    description: 'おまかせ稼働の台選びと見切りが上手くなる。',
    cost: 3,
  },
  {
    id: 'EMERGENCY_FUND',
    name: '生活防衛資金',
    description: '前の人生の反省。最初から15万円を余分に持っている。',
    cost: 2,
  },
  {
    id: 'BODY_MEMORY',
    name: '体が覚えている',
    description: '長時間の稼働に慣れている。毎晩の体力回復+2。',
    cost: 2,
  },
  {
    id: 'THICK_SKIN',
    name: '下振れ慣れ',
    description: '期待値を下回った日の精神の削れ方が小さい。',
    cost: 3,
  },
];

/** 人生が終わったときに得る記憶ポイント */
export function pointsForRun(weeksLived: number, reachedEnd: boolean): number {
  return 1 + Math.floor(weeksLived / 26) + (reachedEnd ? 3 : 0);
}
