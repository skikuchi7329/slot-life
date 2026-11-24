import type { ItemId, ShopItem } from '../types';
import { getEnvironment } from './eras';

/** note（有料記事のプラットフォーム）が始まった日。それまでは有料メルマガ */
const NOTE_LAUNCH = '2014-04-07';
const noteOr = (date: string, note: string, mail: string) => (date >= NOTE_LAUNCH ? note : mail);

/** 打ち子・引き子の日当（2008年時点。物価指数が掛かる）。打ち子はこれに勝ち分の歩合が付く */
export const RUNNER_WAGE = 3_000;
export const PULLER_WAGE = 2_000;
/** 打ち子の歩合（勝った日の勝ち分のうち、打ち子に渡す割合） */
export const RUNNER_SHARE = 0.3;
/** 打ち子に預ける軍資金 */
export const RUNNER_FLOAT = 50_000;
export const MAX_RUNNERS = 2;
export const MAX_PULLERS = 3;

/**
 * 買えるもの。実在する道具・サービスに準えている（名前は ADR-005 と同じくパロディ）。
 * 効果は「見えるものが増える」「小さな下駄」に留め、強さのインフレにはしない（ADR-025）。
 */
export const ITEMS: ShopItem[] = [
  {
    id: 'HAND_COUNTER',
    kind: 'PERMANENT',
    name: () => '小役カウンター（通称カチカチ君）',
    description: '手の中で小役を数える。これがないと、ブドウは目で追うだけになり、判別はボーナスの回数頼みになる。',
    price: 1_980,
    inflates: true,
  },
  {
    id: 'CUSHION',
    kind: 'PERMANENT',
    name: () => 'ゲルクッション',
    description: 'ホールの椅子に敷く。閉店まで座っても、腰の痛みが少しましになる。毎日の体力の削れ−2。',
    price: 3_980,
    inflates: true,
  },
  {
    id: 'NC_EARPHONES',
    kind: 'PERMANENT',
    name: () => 'ノイズキャンセリングイヤホン',
    description: 'ホールの騒音が遠くなる。耳と心が少し守られる。毎日の精神の削れ−1。',
    price: 29_800,
    inflates: false,
    from: '2019-10-30',
  },
  {
    id: 'DATA_SITE',
    kind: 'SUBSCRIPTION',
    name: () => 'データロボ サイトナナ（有料会員）',
    description: '行かなかった店の閉店後データも、毎日ネットで見られる。店の癖を探す材料が一気に増える。',
    price: 330,
    inflates: false,
    from: '2015-01-01',
  },
  {
    id: 'MAGAZINE',
    kind: 'CONSUMABLE',
    name: () => '攻略誌（月刊）',
    description: '天井・ゾーン・ヤメどきの解析が載っている。4週間、ハイエナの期待値+10%。',
    price: 680,
    inflates: true,
    weeks: 4,
  },
  {
    id: 'HYENA_NOTE',
    kind: 'CONSUMABLE',
    name: (d) => noteOr(d, '有料note「天井・ゾーン狙い目まとめ」', '有料メルマガ「天井・ゾーン狙い目」'),
    description: '解析が出回る前の狙い目。8週間、ハイエナの期待値が上がる。ただし中身の薄いものも多い。',
    price: 3_000,
    inflates: false,
    weeks: 8,
  },
  {
    id: 'SHOP_NOTE',
    kind: 'CONSUMABLE',
    name: (d) => noteOr(d, '有料note「地域ホール傾向」', '有料メルマガ「地域ホール攻略」'),
    description: '1店の強い日と入れ方が書いてある。書いてあることが正しいとは限らない。',
    price: 5_000,
    inflates: false,
  },
  {
    id: 'ENERGY_DRINK',
    kind: 'CONSUMABLE',
    name: () => '栄養ドリンク（10本）',
    description: '効いている気がする。体力+6・精神+1。',
    price: 1_500,
    inflates: true,
  },
];

export function getItem(id: ItemId): ShopItem {
  return ITEMS.find((i) => i.id === id)!;
}

/** その日の値段（物の値段には物価指数が掛かる） */
export function itemPrice(item: ShopItem, date: string): number {
  return item.inflates ? Math.round((item.price * getEnvironment(date).priceIndex) / 10) * 10 : item.price;
}

export function itemAvailable(item: ShopItem, date: string): boolean {
  return !item.from || date >= item.from;
}

/** 日当（物価指数が掛かる） */
export function wage(base: number, date: string): number {
  return Math.round((base * getEnvironment(date).priceIndex) / 100) * 100;
}

const RUNNER_NAMES = [
  '大学生の田中',
  'フリーターの佐藤',
  '掲示板で知り合った男',
  '元同僚の弟',
  '夜勤明けの鈴木',
  '無口な若い男',
  '常連の息子',
  '専門学校生の高橋',
];

export function runnerName(taken: string[]): string {
  const free = RUNNER_NAMES.filter((n) => !taken.includes(n));
  const pool = free.length ? free : RUNNER_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
