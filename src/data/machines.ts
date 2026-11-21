import type { Machine } from '../types';

// 実機の公表スペックを参考にした架空機種。
// 機械割は「設定1〜6の長期的な払い出し率」、flags は判別要素と出玉の源泉。
// 機械割と flags の差分は「ベース（リプレイ・その他小役）」として simulation 側で自動補正する。

export const MACHINES: Machine[] = [
  {
    id: 'pekalar_ex',
    name: 'アイムペカラーEX',
    maker: '北電子風',
    type: 'A_TYPE',
    release: '2007-12-01',
    retire: '2022-01-31',
    payoutRates: [97.0, 98.0, 99.5, 101.1, 103.3, 105.5],
    flags: [
      { key: 'BB', label: 'BIG', denominators: [273.1, 269.7, 269.7, 259.0, 259.0, 255.0], payout: 252, payoutSd: 0, countable: true },
      { key: 'RB', label: 'REG', denominators: [439.8, 399.6, 331.0, 315.1, 255.0, 255.0], payout: 96, payoutSd: 0, countable: true },
      { key: 'GRAPE', label: 'ブドウ', denominators: [6.02, 6.0, 5.95, 5.9, 5.85, 5.78], payout: 8, payoutSd: 0, countable: true },
    ],
    gamesPerHour: 720,
    shareWeight: 4,
  },
  {
    id: 'bita_contest',
    name: 'ビタ押しコンテスト',
    maker: 'ユニバ風',
    type: 'TECH',
    release: '2008-01-01',
    retire: '2022-01-31',
    // 技術介入100%時の数値
    payoutRates: [99.0, 100.5, 102.0, 104.0, 106.0, 108.0],
    flags: [
      { key: 'BB', label: 'BIG', denominators: [299.3, 290.0, 280.0, 273.1, 262.1, 252.1], payout: 312, payoutSd: 0, countable: true },
      { key: 'RB', label: 'REG', denominators: [420.1, 390.1, 360.1, 330.0, 300.0, 280.0], payout: 104, payoutSd: 0, countable: true },
      { key: 'CHERRY', label: 'チェリー', denominators: [36.4, 35.5, 34.2, 33.0, 31.8, 30.5], payout: 2, payoutSd: 0, countable: true },
    ],
    gamesPerHour: 700,
    shareWeight: 1,
  },
  {
    id: 'kumicho2',
    name: '押忍！組長2',
    maker: '大都風',
    type: 'AT_HIGH_SPEC',
    release: '2008-01-01',
    retire: '2013-12-31',
    payoutRates: [96.5, 98.0, 101.0, 106.0, 110.0, 119.0],
    flags: [
      { key: 'BB', label: 'BB', denominators: [282.5, 275.4, 268.6, 260.1, 252.1, 240.9], payout: 180, payoutSd: 40, countable: true },
      { key: 'ART', label: 'ART初当り', denominators: [420.0, 395.0, 360.0, 310.0, 280.0, 230.0], payout: 330, payoutSd: 420, countable: true },
    ],
    gamesPerHour: 650,
    shareWeight: 2,
  },
  {
    id: 'god_triumph',
    name: 'ミリオンゴッド 神々の黄金凱旋',
    maker: 'ミズホ風',
    type: 'AT_HIGH_SPEC',
    release: '2015-04-01',
    retire: '2022-01-31',
    payoutRates: [96.7, 98.4, 100.9, 106.0, 111.0, 118.8],
    flags: [
      { key: 'AT', label: 'AT初当り', denominators: [399.6, 390.0, 370.0, 330.0, 300.0, 270.0], payout: 420, payoutSd: 820, countable: true },
      { key: 'GOD', label: 'GOD揃い', denominators: [8192, 8192, 8192, 8192, 7400, 6553], payout: 1500, payoutSd: 1400, countable: true },
    ],
    gamesPerHour: 600,
    shareWeight: 2,
  },
  {
    id: 'restart_zero',
    name: 'Re:リスタート・ゼロ',
    maker: '大都風',
    type: 'AT_HIGH_SPEC',
    release: '2018-08-01',
    retire: '2026-12-31',
    payoutRates: [97.9, 99.2, 101.4, 105.0, 109.0, 114.9],
    flags: [
      // 有利区間2400枚の上限で出玉の裾が切られている
      { key: 'AT', label: 'AT初当り', denominators: [385.0, 370.0, 345.0, 310.0, 290.0, 265.0], payout: 400, payoutSd: 430, countable: true },
      { key: 'WEAK_CHERRY', label: '弱チェリー', denominators: [92.0, 90.0, 88.0, 86.0, 84.0, 80.0], payout: 1, payoutSd: 0, countable: true },
    ],
    gamesPerHour: 620,
    shareWeight: 2,
  },
  {
    id: 'my_pekalar_v',
    name: 'マイペカラーV',
    maker: '北電子風',
    type: 'A_TYPE',
    release: '2021-12-01',
    retire: '2026-12-31',
    payoutRates: [97.0, 98.0, 99.9, 102.8, 105.3, 109.4],
    flags: [
      { key: 'BB', label: 'BIG', denominators: [273.1, 270.8, 266.4, 254.0, 240.9, 229.1], payout: 240, payoutSd: 0, countable: true },
      { key: 'RB', label: 'REG', denominators: [409.6, 385.5, 336.1, 290.0, 268.6, 229.1], payout: 96, payoutSd: 0, countable: true },
      { key: 'GRAPE', label: 'ブドウ', denominators: [5.9, 5.85, 5.8, 5.78, 5.76, 5.66], payout: 8, payoutSd: 0, countable: true },
    ],
    gamesPerHour: 720,
    shareWeight: 4,
  },
  {
    id: 'smaslot_hokuto',
    name: 'スマスロ 世紀末覇者伝',
    maker: 'サミー風',
    type: 'SMASLOT',
    release: '2023-04-03',
    retire: '2026-12-31',
    payoutRates: [97.6, 98.4, 100.7, 106.5, 110.0, 113.0],
    flags: [
      { key: 'AT', label: 'AT初当り', denominators: [383.4, 370.0, 345.0, 315.0, 290.0, 273.1], payout: 680, payoutSd: 1150, countable: true },
    ],
    gamesPerHour: 600,
    shareWeight: 3,
  },
  {
    id: 'smaslot_kumicho4',
    name: 'スマスロ 押忍！組長4',
    maker: '大都風',
    type: 'SMASLOT',
    release: '2022-11-21',
    retire: '2026-12-31',
    payoutRates: [97.5, 98.8, 101.0, 105.2, 110.0, 114.9],
    flags: [
      { key: 'AT', label: 'AT初当り', denominators: [330.0, 320.0, 305.0, 280.0, 260.0, 240.0], payout: 520, payoutSd: 880, countable: true },
      { key: 'TAIKETSU', label: '対決勝利', denominators: [180.0, 175.0, 168.0, 160.0, 150.0, 140.0], payout: 0, payoutSd: 0, countable: true },
    ],
    gamesPerHour: 620,
    shareWeight: 2,
  },
];

export function getMachine(id: string): Machine {
  const m = MACHINES.find((x) => x.id === id);
  if (!m) throw new Error(`unknown machine: ${id}`);
  return m;
}

export function machinesAvailableOn(iso: string): Machine[] {
  return MACHINES.filter((m) => m.release <= iso && iso <= m.retire);
}
