import type { Trait } from '../types';

export const TRAITS: Trait[] = [
  {
    id: 'ex_se',
    name: '元SE',
    description: '貯金はある。体と心は既に削れている。',
    intro: '終電とデスマーチの5年間。退職金と貯金を握りしめて、平日の朝にホールへ並んだ。',
    stats: { cash: 1_200_000, health: 65, mental: 55, socialCredit: 50 },
    monthlyDelta: 0,
  },
  {
    id: 'dropout',
    name: '大学中退',
    description: '若さだけはある。金と肩書きはない。',
    intro: '単位よりも設定判別の方が面白かった。気づけば籍がなくなっていた。',
    stats: { cash: 300_000, health: 95, mental: 85, socialCredit: 20 },
    monthlyDelta: 0,
  },
  {
    id: 'ex_staff',
    name: '元ホール店員',
    description: '店の裏側を知っている。知りすぎている。',
    intro: '設定を打ち込む側にいた3年間。客の顔と、店長の癖は全部覚えている。',
    stats: { cash: 600_000, health: 80, mental: 70, socialCredit: 35 },
    monthlyDelta: 0,
  },
  {
    id: 'allowance',
    name: '実家の仕送り',
    description: '毎月5万円が振り込まれる。そのたびに少し死ぬ。',
    intro: '「資格の勉強をしている」ことになっている。通帳の入金記録だけが親との会話だ。',
    stats: { cash: 400_000, health: 80, mental: 65, socialCredit: 30 },
    monthlyDelta: 50_000,
  },
  {
    id: 'debtor',
    name: '借金持ち',
    description: '手元資金は厚いが、毎月3万円の返済がある。',
    intro: '消費者金融3社から引いた軍資金。期待値で返せる、と計算した。',
    stats: { cash: 900_000, health: 80, mental: 60, socialCredit: 25 },
    monthlyDelta: -30_000,
  },
  {
    id: 'ex_runner',
    name: '元打ち子',
    description: '技術はある。人脈は切れた。',
    intro: '軍団の打ち子として2年。取り分の少なさに嫌気がさして、ひとりで打つことにした。',
    stats: { cash: 500_000, health: 85, mental: 70, socialCredit: 15 },
    monthlyDelta: 0,
  },
];

export function getTrait(id: string): Trait {
  return TRAITS.find((t) => t.id === id) ?? TRAITS[0];
}

/** 新しい人生の開始時に提示する3つの出自 */
export function drawTraitChoices(): Trait[] {
  return [...TRAITS].sort(() => Math.random() - 0.5).slice(0, 3);
}
