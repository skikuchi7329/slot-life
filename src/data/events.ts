import type { EventChoice, EventContext, GameEvent } from '../types';

/** 週の初めに1回判定される突発イベントの発生率 */
export const EVENT_RATE = 0.4;

const month = (ctx: EventContext) => ctx.date.getMonth() + 1;
const year = (ctx: EventContext) => ctx.date.getFullYear();

export const EVENTS: GameEvent[] = [
  {
    id: 'mother_call',
    speaker: '母',
    text: '「元気にしてるの？ ちゃんと働いてるの？ ……お父さんも心配してるのよ」',
    weight: 3,
    condition: () => true,
    choices: [
      { label: '「働いてるよ」と嘘をつく', effect: { mental: -4 }, result: '電話を切ったあと、しばらく天井を見ていた。' },
      { label: '正直に話す', effect: { mental: -8, socialCredit: 3 }, result: '長い沈黙のあと、母は「体だけは大事にね」とだけ言った。' },
      { label: '出ない', effect: { mental: -2, socialCredit: -2 }, result: '着信履歴に「母」の文字が3つ並んだ。' },
    ],
  },
  {
    id: 'wedding',
    speaker: '郵便受け',
    text: '大学の同期から結婚式の招待状が届いた。返信はがきの「ご職業」欄が空白のままだ。',
    weight: 2,
    condition: (ctx) => ctx.player.cash > 100_000,
    choices: [
      {
        label: '出席する（ご祝儀3万＋交通費）',
        effect: { cash: -45_000, mental: -3, socialCredit: 8 },
        result: '「今なにしてるの？」に「投資みたいなこと」と答えた。誰もそれ以上聞かなかった。',
      },
      { label: '欠席してお祝いだけ送る', effect: { cash: -10_000, mental: -3, socialCredit: -2 }, result: '「残念！また飲もう」というLINEが来た。たぶん、もう飲まない。' },
      { label: '返信しない', effect: { socialCredit: -8, mental: -2 }, result: '招待状は、レシートの山の下に埋もれていった。' },
    ],
  },
  {
    id: 'tax_return',
    speaker: '税務署のポスター',
    text: '「確定申告はお早めに」。去年の稼ぎは一時所得なのか雑所得なのか、正直よくわからない。',
    weight: 6,
    condition: (ctx) => month(ctx) === 2 || month(ctx) === 3,
    choices: [
      { label: '税理士に相談して申告する', effect: { cash: -60_000, socialCredit: 8, mental: -2 }, result: '「記録をつけているのは立派ですね」。収支表が初めて人の役に立った。' },
      { label: '自分で調べて申告する', effect: { cash: -25_000, socialCredit: 5, mental: -6 }, result: '国税庁のサイトと格闘して丸一日が消えた。' },
      { label: '黙っておく', effect: { mental: -3 }, result: '何も起きなかった。今年は。' },
    ],
  },
  {
    id: 'back_pain',
    speaker: '体',
    text: '朝、腰に鈍い痛みが走った。1日12時間、同じ姿勢で座り続けた代償だ。',
    weight: 4,
    condition: (ctx) => ctx.player.health < 60,
    choices: [
      { label: '整骨院に行く', effect: { cash: -6_000, health: 12 }, result: '「このままだと癖になりますよ」と言われた。もう癖になっている。' },
      { label: '湿布を貼って我慢する', effect: { cash: -800, health: -4 }, result: 'ドラッグストアの湿布は、ホールの空調で一日中冷たかった。' },
    ],
  },
  {
    id: 'hall_manager',
    speaker: '店長',
    text: '換金所の前で店長に声をかけられた。「いつもありがとうございます。……最近よくお見かけしますね」',
    weight: 5,
    condition: (ctx) => ctx.player.hallMark >= 35,
    choices: [
      { label: 'しばらく顔を出さない', effect: { hallMark: -20, mental: -3 }, result: '行きつけの店が、ひとつ減った。' },
      { label: '会釈して受け流す', effect: { hallMark: 8, mental: -2 }, result: '店長は笑っていた。目以外は。' },
    ],
  },
  {
    id: 'runner_offer',
    speaker: '見知らぬ男',
    text: (ctx) =>
      `抽選待ちの列で声をかけられた。「兄ちゃん、毎日来てるよな。うちで打たないか？ 日当${ctx.env.crowdPressure > 0.5 ? '1万5千' : '1万'}、台はこっちが用意する」`,
    weight: 3,
    condition: (ctx) => ctx.env.crowdPressure >= 0.25,
    choices: (ctx) => [
      { label: '断る', effect: { mental: -1 }, result: '男は舌打ちして、次の若者に声をかけに行った。' },
      {
        label: '一度だけ受ける',
        effect: { cash: ctx.env.crowdPressure > 0.5 ? 15_000 : 10_000, mental: -8, hallMark: 12, socialCredit: -4 },
        result: '指示された台を、指示されたとおりに打った。自分が誰でもない気がした。',
      },
    ],
  },
  {
    id: 'old_colleague',
    speaker: '元同僚',
    text: (ctx) =>
      `${year(ctx) >= 2013 ? 'LINE' : 'メール'}が来た。「久しぶり！ 今なにしてる？ 今度みんなで集まるんだけど」`,
    weight: 3,
    condition: () => true,
    choices: [
      { label: '「フリーランスやってる」と返す', effect: { mental: -3, socialCredit: 2 }, result: '「すごいじゃん！」と返ってきた。すごくはない。' },
      { label: '既読のまま放置する', effect: { mental: -2, socialCredit: -3 }, result: '画面の「既読」の2文字が、やけに重かった。' },
    ],
  },
  {
    id: 'loneliness',
    speaker: '自室',
    text: '気づけば一週間、店員以外と口をきいていない。「ありがとうございました」が、最後に聞いた人の声だ。',
    weight: 3,
    condition: (ctx) => ctx.player.mental < 60,
    choices: [
      { label: '銭湯で常連の爺さんと話す', effect: { cash: -520, mental: 7 }, result: '野球の話をした。巨人が勝ったらしい。それだけで少し救われた。' },
      { label: '何もしない', effect: { mental: -4 }, result: '冷蔵庫のモーター音だけが部屋に響いていた。' },
    ],
  },
  {
    id: 'father_hospital',
    speaker: '妹',
    text: '「お父さんが入院した。大したことないって本人は言ってるけど……帰ってこれる？」',
    weight: 1,
    once: true,
    condition: (ctx) => year(ctx) >= 2012,
    choices: [
      { label: '帰省する', effect: { cash: -40_000, mental: -4, socialCredit: 10 }, result: '父は「仕事は大丈夫なのか」と聞いた。大丈夫だと答えた。' },
      { label: 'お金だけ送る', effect: { cash: -50_000, socialCredit: 2, mental: -6 }, result: '振込の控えを財布にしまった。それが自分にできるすべてだった。' },
      { label: '「忙しい」と言う', effect: { mental: -12, socialCredit: -8 }, result: '妹は何も言わずに電話を切った。' },
    ],
  },
  {
    id: 'job_flyer',
    speaker: 'ポスト',
    text: '求人チラシが入っていた。「倉庫内軽作業スタッフ 時給1,100円〜 未経験歓迎 社員登用あり」',
    weight: 2,
    condition: (ctx) => ctx.player.socialCredit >= 30 || ctx.player.mental < 35,
    choices: (ctx): EventChoice[] => [
      { label: '捨てる', effect: { mental: -1 }, result: 'チラシはゴミ袋の中へ消えた。時給換算なら、こちらの方が上だ。たぶん。' },
      {
        label: '応募する（足を洗う）',
        effect: {},
        result: '電話の向こうで、明るい声が面接の日時を告げた。',
        endRun:
          ctx.player.cash > 0
            ? `${year(ctx)}年、パチスロを辞めた。収支表は最後の行を書かずに閉じた。期待値の外側にも、生活はあった。`
            : '何もかも失ってから、ようやく辞められた。',
      },
    ],
  },
];

export function getEvent(id: string): GameEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function resolveText(event: GameEvent, ctx: EventContext): string {
  return typeof event.text === 'function' ? event.text(ctx) : event.text;
}

export function resolveChoices(event: GameEvent, ctx: EventContext): EventChoice[] {
  return typeof event.choices === 'function' ? event.choices(ctx) : event.choices;
}
