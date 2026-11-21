import type { Flag, Machine, PremiumStyle } from '../types';

// 実機の公表スペックを参考にした架空機種。
// 機械割は「設定1〜6の長期的な払い出し率」、flags は判別要素と出玉の源泉。
// 機械割と flags の差分は「ベース（リプレイ・その他小役）」として simulation 側で自動補正する。
//
// 示唆（HINT）の分母に Infinity を入れた設定では出現しない＝確定演出になる。
// published: false の示唆は「噂」。自作の判別ツールに入らず、多くは設定差がほぼない偽物。

type Six = [number, number, number, number, number, number];
const X = Infinity;

function normal(key: string, label: string, denominators: Six, payout: number, payoutSd = 0, countable = true): Flag {
  return { key, label, denominators, payout, payoutSd, countable, kind: 'NORMAL' };
}

function hint(key: string, label: string, denominators: Six, text: string, meaning: string, opts: { published?: boolean; style?: PremiumStyle } = {}): Flag {
  return {
    key,
    label,
    denominators,
    payout: 0,
    payoutSd: 0,
    countable: true,
    kind: 'HINT',
    text,
    meaning,
    published: opts.published ?? true,
    style: opts.style,
  };
}

function premium(key: string, label: string, denominators: Six, payout: number, payoutSd: number, text: string, style: PremiumStyle): Flag {
  return { key, label, denominators, payout, payoutSd, countable: true, kind: 'PREMIUM', text, style, published: true };
}

const FREEZE_TEXT = 'レバーを叩いた。\nリールが、回らない。\n……フリーズ。';

export const MACHINES: Machine[] = [
  // ============================================================
  // 5号機黎明期〜（2008〜）
  // ============================================================
  {
    id: 'pekalar_ex',
    name: 'アイムペカラーEX',
    maker: '北電子風',
    type: 'A_TYPE',
    release: '2007-12-01',
    retire: '2022-01-31',
    payoutRates: [97.0, 98.0, 99.5, 101.1, 103.3, 105.5],
    // 示唆もプレミアもない。ブドウを数えるだけの機種
    flags: [
      normal('BB', 'BIG', [273.1, 269.7, 269.7, 259.0, 259.0, 255.0], 252),
      normal('RB', 'REG', [439.8, 399.6, 331.0, 315.1, 255.0, 255.0], 96),
      normal('GRAPE', 'ブドウ', [6.02, 6.0, 5.95, 5.9, 5.85, 5.78], 8),
    ],
    gamesPerHour: 720,
    shareWeight: 4,
  },
  {
    id: 'hibiscus_30',
    name: 'ハイビスカス30',
    maker: 'パイオニア風',
    type: 'A_TYPE',
    release: '2008-03-01',
    retire: '2022-01-31',
    payoutRates: [97.0, 98.5, 100.0, 102.5, 105.0, 109.0],
    flags: [
      normal('BB', 'BIG', [297.9, 284.9, 273.1, 260.1, 248.2, 240.9], 220),
      normal('RB', 'REG', [496.5, 471.5, 445.2, 420.1, 397.2, 364.1], 96),
      normal('BELL', 'ベル', [7.5, 7.45, 7.4, 7.35, 7.3, 7.2], 10),
      hint('SIDE_BLUE', 'REG中ランプ青', [1200, 1600, 1200, 1600, 1200, 1600], 'REG中、サイドランプが青く光った。', '奇数設定示唆'),
      hint('SIDE_RAINBOW', 'REG中ランプ虹', [X, X, X, X, X, 2400], 'REG中、サイドランプが虹色に光った。', '設定6確定', { style: 'CONFIRM' }),
      hint('SUIKA_RUMOR', 'BIG中スイカ連', [520, 515, 510, 505, 500, 495], 'BIG中、スイカがやけに揃う。', '高設定の証（常連談）', { published: false }),
    ],
    gamesPerHour: 700,
    shareWeight: 2,
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
      normal('BB', 'BIG', [299.3, 290.0, 280.0, 273.1, 262.1, 252.1], 312),
      normal('RB', 'REG', [420.1, 390.1, 360.1, 330.0, 300.0, 280.0], 104),
      normal('CHERRY', 'チェリー', [36.4, 35.5, 34.2, 33.0, 31.8, 30.5], 2),
      hint('SOUND_RUMOR', '高音の成功音', [800, 800, 795, 795, 790, 790], 'ビタ押しの成功音が、いつもより高く聞こえた。', '設定が良い日の音（噂）', { published: false }),
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
      normal('BB', 'BB', [282.5, 275.4, 268.6, 260.1, 252.1, 240.9], 180, 40),
      normal('ART', 'ART初当り', [420.0, 395.0, 360.0, 310.0, 280.0, 230.0], 330, 420),
      hint('NIGHT', '対決・夜背景', [900, 700, 900, 700, 900, 700], '対決演出が夜の背景で始まった。', '偶数設定示唆'),
      hint('ANESAN', '終了画面・姐さん', [X, X, X, X, X, 3000], 'BB終了画面に、姐さんが現れた。', '設定6確定', { style: 'CONFIRM' }),
      hint('BLUE_RUMOR', '青文字セリフ', [400, 400, 398, 398, 395, 395], 'BB中、青い文字のセリフが出た。', '高設定示唆（ネットの噂）', { published: false }),
    ],
    gamesPerHour: 650,
    shareWeight: 2,
  },
  {
    id: 'luna_seven',
    name: '交響詩篇ルナセブン',
    maker: 'サミー風',
    type: 'AT_HIGH_SPEC',
    release: '2008-04-01',
    retire: '2012-12-31',
    payoutRates: [97.0, 98.5, 101.0, 105.0, 110.0, 115.0],
    flags: [
      normal('BB', 'BB', [300, 295, 290, 280, 270, 260], 150, 30),
      normal('ART', 'ART初当り', [440, 420, 390, 350, 310, 280], 300, 380),
      hint('ALL_CAST', '終了画面・全員', [X, X, X, 2400, 2000, 1600], 'ART終了画面に、登場人物が全員並んだ。', '設定4以上濃厚', { style: 'CONFIRM' }),
      hint('RED_MOON', '赤い月', [600, 600, 595, 595, 590, 590], '液晶の月が、赤く染まった。', '高設定示唆（掲示板の噂）', { published: false }),
      premium('FREEZE', '全リールフリーズ', [16384, 16384, 16384, 16384, 16384, 16384], 1500, 600, FREEZE_TEXT, 'FREEZE'),
    ],
    gamesPerHour: 650,
    shareWeight: 2,
  },
  {
    id: 'hokuto_se',
    name: '世紀末救世主伝説SE',
    maker: 'サミー風',
    type: 'AT_HIGH_SPEC',
    release: '2008-03-01',
    retire: '2013-06-30',
    payoutRates: [97.5, 98.6, 100.8, 104.2, 108.5, 113.0],
    flags: [
      normal('BB', 'バトルボーナス', [350, 340, 320, 300, 280, 260], 200, 350),
      hint('RED_STAGE', '赤ステージ', [260, 250, 240, 230, 220, 210], '通常時、ステージが赤く変わった。', '高設定示唆（弱）'),
      hint('RAOH', '終了画面・昇天', [X, X, X, X, 3000, 2200], 'バトルボーナス終了画面で、拳王が天に還った。', '設定5以上濃厚', { style: 'CONFIRM' }),
      hint('HORSE_RUMOR', '黒王の目', [700, 700, 700, 700, 695, 695], '黒王号の目が、一瞬光った気がした。', '設定6の合図（噂）', { published: false }),
      premium('FREEZE', '天破フリーズ', [16384, 16384, 16384, 16384, 16384, 16384], 2500, 1500, FREEZE_TEXT, 'FREEZE'),
    ],
    gamesPerHour: 650,
    shareWeight: 2,
  },

  // ============================================================
  // 5号機ART全盛期（2012〜）
  // ============================================================
  {
    id: 'hades',
    name: 'アナザー冥王ハーデス',
    maker: 'ユニバ風',
    type: 'AT_HIGH_SPEC',
    release: '2012-11-01',
    retire: '2020-12-31',
    payoutRates: [96.0, 97.6, 99.6, 104.1, 109.5, 113.7],
    flags: [
      normal('AT', 'AT初当り', [460, 440, 420, 390, 360, 330], 520, 900),
      hint('MEIOU', '終了画面・冥王', [X, X, X, 3200, 2600, 2000], 'AT終了画面に、冥王が佇んでいた。', '設定4以上濃厚', { style: 'CONFIRM' }),
      hint('RENGOKU_RUMOR', '煉獄ステージ', [500, 500, 498, 498, 495, 495], 'ステージが煉獄に移った。', '高設定ほど来る（噂）', { published: false }),
      premium('ALL_SPIN', '全回転', [8192, 8192, 8192, 8192, 8192, 8192], 3000, 1500, '画面が暗転した。\n冥王の門が、ゆっくりと開いていく。', 'BLACKOUT'),
    ],
    gamesPerHour: 620,
    shareWeight: 2,
  },
  {
    id: 'stella_magia',
    name: '奇跡少女ステラ☆マギア',
    maker: '京楽風',
    type: 'AT_HIGH_SPEC',
    release: '2013-05-01',
    retire: '2020-12-31',
    payoutRates: [97.4, 98.6, 100.3, 105.8, 109.5, 113.4],
    flags: [
      normal('ART', 'ボーナス+ART', [380, 370, 355, 320, 295, 270], 350, 450),
      normal('WEAK_CHERRY', '弱チェリー', [90, 88, 87, 85, 83, 80], 1),
      hint('NIGHT_CITY', '終了画面・夜の街', [1500, 1100, 1500, 1100, 1500, 1100], 'ボーナス終了画面に、夜の街が映った。', '偶数設定示唆'),
      hint('FIVE', 'キャラ5人', [X, X, X, X, X, 3600], 'エピソードボーナスに、5人全員が揃った。', '設定6確定', { style: 'CONFIRM' }),
      hint('GEM_RUMOR', '濁った宝石', [450, 450, 448, 448, 446, 446], '宝石の色が、少し濁って見えた。', '低設定の合図（噂）', { published: false }),
    ],
    gamesPerHour: 620,
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
      normal('AT', 'AT初当り', [399.6, 390.0, 370.0, 330.0, 300.0, 270.0], 420, 820),
      hint('RED7', '終了画面・赤7', [X, X, X, X, X, 4800], 'AT終了画面に、赤7が揃って映った。', '設定6確定', { style: 'CONFIRM' }),
      hint('THUNDER_RUMOR', '雷が多い', [300, 300, 298, 298, 296, 296], 'ゴッドゾーン中、やけに雷が落ちた。', '高設定示唆（噂）', { published: false }),
      premium('GOD', 'GOD揃い', [8192, 8192, 8192, 8192, 7400, 6553], 1500, 1400, '画面が暗転した。\nリールに、GODが揃っている。', 'BLACKOUT'),
    ],
    gamesPerHour: 600,
    shareWeight: 2,
  },
  {
    id: 'kumicho3',
    name: '押忍！組長3',
    maker: '大都風',
    type: 'AT_HIGH_SPEC',
    release: '2014-08-01',
    retire: '2022-01-31',
    payoutRates: [97.1, 98.2, 100.5, 104.5, 108.2, 112.0],
    flags: [
      normal('AT', 'AT初当り', [340, 330, 315, 295, 275, 255], 380, 500),
      hint('ANESAN', '対決・姐さん', [X, 1800, 1800, 1700, 1700, 1600], '対決の相手に、姐さんが選ばれた。', '設定2以上濃厚'),
      hint('ALL_CAST', '終了画面・全員集合', [X, X, X, 2800, 2400, 1900], 'AT終了画面に、全員が集合していた。', '設定4以上濃厚', { style: 'CONFIRM' }),
      hint('SWEAT_RUMOR', '汗をかく組長', [480, 480, 478, 478, 476, 476], '組長が、汗をかいている。', '高設定示唆（噂）', { published: false }),
    ],
    gamesPerHour: 640,
    shareWeight: 2,
  },

  // ============================================================
  // 6号機（2018〜）
  // ============================================================
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
      normal('AT', 'AT初当り', [385.0, 370.0, 345.0, 310.0, 290.0, 265.0], 400, 430),
      normal('WEAK_CHERRY', '弱チェリー', [92.0, 90.0, 88.0, 86.0, 84.0, 80.0], 1),
      hint('SAKURA', '終了画面・夜桜', [X, X, X, X, X, 4200], 'AT終了画面に、夜桜が舞った。', '設定6確定', { style: 'CONFIRM' }),
      hint('WHALE_RUMOR', '白鯨戦勝利', [350, 350, 348, 348, 346, 346], '白鯨戦に勝利した。', '高設定ほど勝てる（噂）', { published: false }),
      premium('FREEZE', 'ゼロからフリーズ', [16384, 16384, 16384, 16384, 16384, 16384], 1200, 400, FREEZE_TEXT, 'FREEZE'),
    ],
    gamesPerHour: 620,
    shareWeight: 2,
  },
  {
    id: 'houou',
    name: 'ハイビスカス鳳凰',
    maker: 'パイオニア風',
    type: 'A_TYPE',
    release: '2019-03-01',
    retire: '2026-12-31',
    payoutRates: [97.0, 98.5, 100.0, 102.5, 105.0, 108.5],
    flags: [
      normal('BB', 'BIG', [297.9, 284.9, 273.1, 262.1, 250.1, 240.9], 220),
      normal('RB', 'REG', [496.5, 471.5, 445.2, 420.1, 397.2, 364.1], 96),
      normal('BELL', 'ベル', [7.5, 7.45, 7.4, 7.35, 7.3, 7.2], 10),
      hint('SIDE_BLUE', 'REG中ランプ青', [1200, 1600, 1200, 1600, 1200, 1600], 'REG中、サイドランプが青く光った。', '奇数設定示唆'),
      hint('RAINBOW', 'BIG後レインボー', [X, X, X, 3000, 2500, 1800], 'BIG終了後、サイドランプがレインボーに光った。', '設定4以上濃厚', { style: 'CONFIRM' }),
      hint('SUIKA_RUMOR', 'スイカ2連', [600, 600, 598, 598, 596, 596], 'スイカが2回続けて揃った。', '設定6の挙動（常連談）', { published: false }),
    ],
    gamesPerHour: 700,
    shareWeight: 2,
  },
  {
    id: 'disc_dancer',
    name: 'ディスクダンサー2',
    maker: 'サミー風',
    type: 'TECH',
    release: '2019-07-01',
    retire: '2026-12-31',
    payoutRates: [100.2, 101.0, 102.0, 103.5, 105.5, 108.0],
    flags: [
      normal('BB', 'BIG', [280, 275, 270, 262, 255, 245], 252),
      normal('RB', 'REG', [420, 400, 380, 360, 340, 315], 96),
      normal('CHERRY', 'チェリー', [36.0, 35.2, 34.0, 33.0, 32.0, 31.0], 2),
      hint('RED_LIGHT', 'BIG中赤照明', [700, 680, 650, 620, 590, 550], 'BIG中、天井の照明が赤くなった。', '高設定示唆'),
      hint('DANCE_RUMOR', 'ダンサーの笑顔', [520, 520, 518, 518, 516, 516], 'ダンサーが、こちらに笑いかけた気がした。', '設定6の合図（噂）', { published: false }),
    ],
    gamesPerHour: 680,
    shareWeight: 1,
  },
  {
    id: 'hades_ultimate',
    name: '冥王ハーデス ULTIMATE',
    maker: 'ユニバ風',
    type: 'AT_HIGH_SPEC',
    release: '2021-06-01',
    retire: '2026-12-31',
    payoutRates: [97.3, 98.4, 100.4, 104.0, 107.6, 111.5],
    flags: [
      normal('AT', 'AT初当り', [400, 385, 365, 340, 315, 290], 480, 560),
      hint('MEIOU', '終了画面・冥王', [X, X, X, X, X, 4500], 'AT終了画面に、冥王が微笑んでいた。', '設定6確定', { style: 'CONFIRM' }),
      hint('RENGOKU_RUMOR', '煉獄ステージ', [500, 500, 498, 498, 495, 495], 'ステージが煉獄に移った。', '高設定ほど来る（噂）', { published: false }),
      premium('ALL_SPIN', '全回転', [8192, 8192, 8192, 8192, 8192, 8192], 2000, 400, '画面が暗転した。\n冥王の門が、ゆっくりと開いていく。', 'BLACKOUT'),
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
      normal('BB', 'BIG', [273.1, 270.8, 266.4, 254.0, 240.9, 229.1], 240),
      normal('RB', 'REG', [409.6, 385.5, 336.1, 290.0, 268.6, 229.1], 96),
      normal('GRAPE', 'ブドウ', [5.9, 5.85, 5.8, 5.78, 5.76, 5.66], 8),
    ],
    gamesPerHour: 720,
    shareWeight: 4,
  },
  {
    id: 'funky_pekalar_2',
    name: 'ファンキーペカラー2',
    maker: '北電子風',
    type: 'A_TYPE',
    release: '2021-12-01',
    retire: '2026-12-31',
    payoutRates: [97.0, 98.5, 99.8, 102.0, 104.3, 109.0],
    flags: [
      normal('BB', 'BIG', [266.4, 259.0, 256.0, 249.2, 240.9, 219.9], 240),
      normal('RB', 'REG', [439.8, 407.1, 366.1, 322.8, 299.3, 262.1], 96),
      normal('GRAPE', 'ブドウ', [5.94, 5.93, 5.88, 5.83, 5.76, 5.66], 8),
    ],
    gamesPerHour: 720,
    shareWeight: 2,
  },

  // ============================================================
  // スマスロ期（2022-11〜）
  // ============================================================
  {
    id: 'smaslot_hokuto',
    name: 'スマスロ 世紀末覇者伝',
    maker: 'サミー風',
    type: 'SMASLOT',
    release: '2023-04-03',
    retire: '2026-12-31',
    payoutRates: [97.6, 98.4, 100.7, 106.5, 110.0, 113.0],
    flags: [
      normal('AT', 'AT初当り', [383.4, 370.0, 345.0, 315.0, 290.0, 273.1], 680, 1150),
      hint('NIGHT', '通常時・夜背景', [300, 290, 280, 270, 260, 250], '通常時、背景が夜に変わった。', '高設定示唆（弱）'),
      hint('HAOU', '終了画面・覇者', [X, X, X, X, X, 4000], 'AT終了画面に、覇者が拳を掲げていた。', '設定6確定', { style: 'CONFIRM' }),
      hint('HORSE_RUMOR', '黒王の嘶き', [650, 650, 648, 648, 646, 646], '黒王号が、高く嘶いた。', '設定6の合図（噂）', { published: false }),
      premium('FREEZE', '無想転生フリーズ', [8192, 8192, 8192, 8192, 8192, 8192], 3000, 2000, FREEZE_TEXT, 'FREEZE'),
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
      normal('AT', 'AT初当り', [330.0, 320.0, 305.0, 280.0, 260.0, 240.0], 520, 880),
      normal('TAIKETSU', '対決勝利', [180.0, 175.0, 168.0, 160.0, 150.0, 140.0], 0),
      hint('ITADAKI', '終了画面・頂', [X, X, X, X, 3500, 2500], 'AT終了画面に「頂」の文字が浮かんだ。', '設定5以上濃厚', { style: 'CONFIRM' }),
      hint('SWEAT_RUMOR', '汗をかく組長', [480, 480, 478, 478, 476, 476], '組長が、汗をかいている。', '高設定示唆（噂）', { published: false }),
    ],
    gamesPerHour: 620,
    shareWeight: 2,
  },
  {
    id: 'smaslot_valv',
    name: 'スマスロ 革命機ギルトレイブ',
    maker: 'SANKYO風',
    type: 'SMASLOT',
    release: '2022-11-21',
    retire: '2026-12-31',
    payoutRates: [97.3, 98.2, 100.0, 104.8, 108.5, 114.9],
    flags: [
      normal('AT', 'AT初当り', [400, 390, 370, 340, 315, 290], 720, 1300),
      hint('TWO_UP', '設定2以上示唆', [X, 2200, 2200, 2100, 2100, 2000], 'ボーナス終了画面に、紫のエンブレムが出た。', '設定2以上濃厚'),
      hint('ALL_CAST', '終了画面・全員集合', [X, X, X, 3000, 2600, 2000], 'AT終了画面に、全員が集合していた。', '設定4以上濃厚', { style: 'CONFIRM' }),
      hint('RED_RUMOR', '赤い機体', [420, 420, 418, 418, 416, 416], '液晶の機体が、赤く染まった。', '高設定示唆（噂）', { published: false }),
      premium('FREEZE', '超覚醒フリーズ', [16384, 16384, 16384, 16384, 16384, 16384], 4000, 2500, FREEZE_TEXT, 'FREEZE'),
    ],
    gamesPerHour: 600,
    shareWeight: 3,
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

/** データカウンターに出る役（ボーナス・AT初当り） */
export function counterFlags(machine: Machine): Flag[] {
  return machine.flags.filter((f) => (f.kind ?? 'NORMAL') === 'NORMAL' && f.payout > 8);
}

/** 手元の小役カウンターで数える役 */
export function handCounterFlags(machine: Machine): Flag[] {
  return machine.flags.filter((f) => (f.kind ?? 'NORMAL') === 'NORMAL' && f.countable);
}

/** 示唆・プレミア（判別メモに書き留めるもの） */
export function noteFlags(machine: Machine): Flag[] {
  return machine.flags.filter((f) => f.kind === 'HINT' || f.kind === 'PREMIUM');
}
