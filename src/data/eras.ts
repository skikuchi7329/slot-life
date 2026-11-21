import type { Environment, Era, RegulationNews } from '../types';

export const GAME_START_DATE = '2008-04-01';
export const GAME_END_DATE = '2026-12-31';

export const ERAS: Era[] = [
  {
    id: 'era_5th_early',
    name: '5号機黎明期',
    start: '2008-01-01',
    end: '2010-12-31',
    description: '4号機が消え、ホールは手探り。告知イベントは合法で、等価交換が当たり前だった。',
  },
  {
    id: 'era_5th_golden',
    name: '5号機ART全盛期',
    start: '2011-01-01',
    end: '2018-01-31',
    description: 'ARTの荒波と広告規制。設定は「匂わせ」の行間から読むものになった。',
  },
  {
    id: 'era_6th_early',
    name: '6号機・2400枚規制期',
    start: '2018-02-01',
    end: '2022-11-20',
    description: '有利区間と出玉上限。勝っても上限で止まり、負けは止まらない。',
  },
  {
    id: 'era_smaslot',
    name: 'スマスロ期',
    start: '2022-11-21',
    end: '2026-12-31',
    description: 'メダルレスの荒波AT。抽選は軍団に埋まり、SNSに情報が流れる。',
  },
];

const INITIAL_ENVIRONMENT: Omit<Environment, 'era'> = {
  exchangeRate: 20,
  eventsAllowed: true,
  generosity: 1.1,
  crowdPressure: 0.15,
  hyenaCoinsPerHour: 45,
  priceIndex: 1.0,
  monthlyFixedCost: 95_000,
};

/** 規制・社会ニュース。日付到達で環境に累積適用される */
export const REGULATION_NEWS: RegulationNews[] = [
  {
    date: '2011-03-14',
    headline: '東日本大震災、関東のホールで節電営業',
    body: '計画停電でホールは短縮営業。客足が鈍り、店は設定を絞り始めた。',
    apply: { generosity: 0.95 },
  },
  {
    date: '2011-07-01',
    headline: '広告宣伝規制の強化 ― 告知イベント事実上禁止',
    body: '「○○の日」「全台系」の告知は消えた。以後、店の意図は来店演者や看板の色から読むしかない。',
    apply: { eventsAllowed: false, generosity: 0.9 },
  },
  {
    date: '2014-04-01',
    headline: '消費税、5%から8%へ',
    body: 'コンビニ弁当が少し高くなった。貸メダルは1枚20円のまま。上がるのは出ていく方だけだ。',
    apply: { priceIndex: 1.04, monthlyFixedCost: 98_000 },
  },
  {
    date: '2014-09-01',
    headline: '5.9号機の登場',
    body: 'ART純増に枷がはめられた。ハイエナで拾える期待値が目に見えて薄くなる。',
    apply: { hyenaCoinsPerHour: 30 },
  },
  {
    date: '2015-06-01',
    headline: '都内ホールで等価交換の廃止が進む（5.6枚交換）',
    body: '借りるときは20円、換えるときは17.86円。現金投資のたびに約11%が消える。持ちメダル遊技の価値が跳ね上がった。',
    apply: { exchangeRate: 17.86, crowdPressure: 0.25 },
  },
  {
    date: '2018-02-01',
    headline: '改正遊技機規則施行 ― 6号機・有利区間2400枚',
    body: '一撃の上限が定められた。ホールの稼働は落ち、店は高設定を入れる余力を失っていく。',
    apply: { generosity: 0.85, hyenaCoinsPerHour: 22 },
  },
  {
    date: '2019-10-01',
    headline: '消費税10%、軽減税率スタート',
    body: 'イートインかテイクアウトか、レジで聞かれるようになった。誰とも食べないので、いつもテイクアウトだ。',
    apply: { priceIndex: 1.07, monthlyFixedCost: 101_000 },
  },
  {
    date: '2020-04-07',
    headline: '緊急事態宣言 ― ホールに休業要請',
    body: '開いている店に客が殺到し、名前が報道された。専業の収入はゼロになった。',
    apply: { crowdPressure: 0.35 },
  },
  {
    date: '2022-01-31',
    headline: '5号機の完全撤去',
    body: 'ジャグラーの古い筐体も、凱旋も、すべて島から消えた。',
    apply: {},
  },
  {
    date: '2022-04-01',
    headline: '値上げラッシュ ― 電気代とガス代が跳ね上がる',
    body: '円安と燃料高。冷蔵庫のモーター音すら、電気代に聞こえるようになった。',
    apply: { priceIndex: 1.12, monthlyFixedCost: 106_000 },
  },
  {
    date: '2022-11-21',
    headline: 'スマスロ（メダルレス）導入開始',
    body: '出玉上限の撤廃に近い荒波。σは5号機の倍以上。抽選には見慣れない若い集団が並び始めた。',
    apply: { crowdPressure: 0.55, hyenaCoinsPerHour: 15, generosity: 0.95 },
  },
  {
    date: '2024-06-01',
    headline: '軍団とSNS収支報告の時代',
    body: '抽選番号は組織的に押さえられ、高設定の島は開店5分で埋まる。ハイエナ台はアプリで共有されている。',
    apply: { crowdPressure: 0.75, hyenaCoinsPerHour: 9 },
  },
  {
    date: '2024-07-03',
    headline: '新紙幣発行 ― サンドが新札を飲まない',
    body: '渋沢栄一の一万円札が、台間サンドから何度も吐き戻された。両替機の前に小さな列ができた。',
    apply: { priceIndex: 1.18, monthlyFixedCost: 112_000 },
  },
  {
    date: '2025-05-01',
    headline: '米価高騰 ― 5kgが4,000円台に',
    body: 'もやしと米だけは安いと思っていた。スーパーの米の棚の前で、しばらく値札を見ていた。',
    apply: { priceIndex: 1.26, monthlyFixedCost: 118_000 },
  },
];

export function getEra(iso: string): Era {
  return ERAS.find((e) => iso >= e.start && iso <= e.end) ?? ERAS[ERAS.length - 1];
}

export function getEnvironment(iso: string): Environment {
  const env = { ...INITIAL_ENVIRONMENT };
  for (const news of REGULATION_NEWS) {
    if (news.date <= iso) Object.assign(env, news.apply);
  }
  return { ...env, era: getEra(iso) };
}

/** (from, to] の範囲に施行されたニュース */
export function newsBetween(fromIso: string, toIso: string): RegulationNews[] {
  return REGULATION_NEWS.filter((n) => n.date > fromIso && n.date <= toIso);
}
