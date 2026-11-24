import type { EventChoice, EventContext, GameEvent } from '../types';
import { parseDate } from '../utils/format';

/** 週の初めに1回判定される突発イベントの発生率 */
export const EVENT_RATE = 0.4;

const month = (ctx: EventContext) => ctx.date.getMonth() + 1;
const year = (ctx: EventContext) => ctx.date.getFullYear();

/** フラグが立ってから何ヶ月たったか（立っていなければ -1） */
function monthsSince(ctx: EventContext, flag: string): number {
  const d = ctx.flagDates[flag];
  if (!d) return -1;
  const from = parseDate(d);
  return (ctx.date.getFullYear() - from.getFullYear()) * 12 + ctx.date.getMonth() - from.getMonth();
}

export const EVENTS: GameEvent[] = [
  // ============================================================
  // 日常
  // ============================================================
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
    id: 'old_colleague',
    speaker: '元同僚',
    text: (ctx) => `${year(ctx) >= 2013 ? 'LINE' : 'メール'}が来た。「久しぶり！ 今なにしてる？ 今度みんなで集まるんだけど」`,
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

  // ============================================================
  // 同期との縁：結婚式 → 飲み → 仕事の紹介（就職エンド）
  // ============================================================
  {
    id: 'wedding',
    speaker: '郵便受け',
    text: '大学の同期から結婚式の招待状が届いた。返信はがきの「ご職業」欄が空白のままだ。',
    weight: 2,
    once: true,
    condition: (ctx) => ctx.player.cash > 100_000,
    choices: [
      {
        label: '出席する（ご祝儀3万＋交通費）',
        effect: { cash: -45_000, mental: -3, socialCredit: 8 },
        result: '「今なにしてるの？」に「投資みたいなこと」と答えた。誰もそれ以上聞かなかった。',
        setFlags: { friend: 1 },
      },
      { label: '欠席してお祝いだけ送る', effect: { cash: -10_000, mental: -3, socialCredit: -2 }, result: '「残念！また飲もう」というLINEが来た。たぶん、もう飲まない。' },
      { label: '返信しない', effect: { socialCredit: -8, mental: -2 }, result: '招待状は、レシートの山の下に埋もれていった。' },
    ],
  },
  {
    id: 'friend_drink',
    speaker: '同期',
    text: '結婚式で会った同期から連絡が来た。「この前はありがとな。今度、二人で飲まないか」',
    weight: 4,
    condition: (ctx) => (ctx.flags.friend ?? 0) === 1 && monthsSince(ctx, 'friend') >= 6,
    choices: [
      { label: '行く', effect: { cash: -6_000, mental: 8, socialCredit: 4 }, result: '焼き鳥屋で3時間話した。パチスロの話は、一度もしなかった。', setFlags: { friend: 1 } },
      { label: '断る', effect: { mental: -2, socialCredit: -2 }, result: '「また誘うわ」。その「また」は来るのだろうか。', setFlags: { friend: -1 } },
    ],
  },
  {
    id: 'friend_job',
    speaker: '同期',
    text: '「なあ、うちの会社で人が足りないんだ。お前、数字に強かったよな。……一回、話だけでも聞きに来ないか」',
    weight: 5,
    once: true,
    condition: (ctx) => (ctx.flags.friend ?? 0) >= 2 && ctx.player.socialCredit >= 40 && monthsSince(ctx, 'friend') >= 3,
    choices: [
      {
        label: '話を聞きに行く（足を洗う）',
        effect: {},
        result: '',
        endRun: { ending: 'JOB', text: '同期の紹介で、小さな会社の経理として働き始めた。毎日Excelを開いている。違うのは、列の見出しだけだ。' },
      },
      { label: '「まだ、やり残したことがある」と断る', effect: { mental: -4 }, result: '電話を切ったあと、データカウンターの数字が少しだけ色褪せて見えた。' },
    ],
  },

  // ============================================================
  // 家族：父の入院 → 介護（実家エンド）
  // ============================================================
  {
    id: 'father_hospital',
    speaker: '妹',
    text: '「お父さんが入院した。大したことないって本人は言ってるけど……帰ってこれる？」',
    weight: 1,
    once: true,
    condition: (ctx) => year(ctx) >= 2012,
    choices: [
      { label: '帰省する', effect: { cash: -40_000, mental: -4, socialCredit: 10 }, result: '父は「仕事は大丈夫なのか」と聞いた。大丈夫だと答えた。', setFlags: { father: 2 } },
      { label: 'お金だけ送る', effect: { cash: -50_000, socialCredit: 2, mental: -6 }, result: '振込の控えを財布にしまった。それが自分にできるすべてだった。', setFlags: { father: 1 } },
      { label: '「忙しい」と言う', effect: { mental: -12, socialCredit: -8 }, result: '妹は何も言わずに電話を切った。', setFlags: { father: 1 } },
    ],
  },
  {
    id: 'father_care',
    speaker: '妹',
    text: '「お父さん、退院したけど一人で歩けないの。お母さんだけじゃもう限界。……お兄ちゃん、どうする？」',
    weight: 6,
    once: true,
    condition: (ctx) => (ctx.flags.father ?? 0) >= 1 && monthsSince(ctx, 'father') >= 8,
    choices: (ctx): EventChoice[] => [
      {
        label: '実家に帰る（足を洗う）',
        effect: {},
        result: '',
        endRun: {
          ending: 'HOMETOWN',
          text: `${year(ctx)}年、実家に帰った。父の車椅子を押して、近所のスーパーまで歩く。パチンコ屋の前を通るとき、父が「懐かしいな」と言った。`,
        },
      },
      { label: '毎月5万円を仕送りする', effect: { mental: -6, socialCredit: 6 }, result: '妹は「ありがとう」と言った。声が少し疲れていた。', setFlags: { sendMoney: 1 } },
      { label: '施設の費用を一括で出す（50万円）', effect: { cash: -500_000, mental: -4, socialCredit: 8 }, result: '期待値で稼いだ金が、父の部屋代になった。' },
      { label: '「無理だ」と言う', effect: { mental: -20, socialCredit: -15 }, result: 'それから、実家からの電話は鳴らなくなった。' },
    ],
  },

  // ============================================================
  // ホールの裏側：軍団の勧誘 → 加入（軍団エンド） / 店長の誘い（店員エンド）
  // ============================================================
  {
    id: 'runner_offer',
    speaker: '見知らぬ男',
    text: (ctx) =>
      `抽選待ちの列で声をかけられた。「兄ちゃん、毎日来てるよな。うちで打たないか？ 日当${ctx.env.crowdPressure > 0.5 ? '1万5千' : '1万'}、台はこっちが用意する」`,
    weight: 3,
    condition: (ctx) => ctx.env.crowdPressure >= 0.25 && (ctx.flags.gundan ?? 0) < 2,
    choices: (ctx) => [
      { label: '断る', effect: { mental: -1 }, result: '男は舌打ちして、次の若者に声をかけに行った。' },
      {
        label: '一度だけ受ける',
        effect: { cash: ctx.env.crowdPressure > 0.5 ? 15_000 : 10_000, mental: -8, hallMark: 12, socialCredit: -4 },
        result: '指示された台を、指示されたとおりに打った。自分が誰でもない気がした。',
        setFlags: { gundan: 1 },
      },
    ],
  },
  {
    id: 'gundan_invite',
    speaker: '軍団のリーダー',
    text: '「お前、筋がいいな。もう、うちの人間だろ。明日から朝イチの抽選、うちの番号で並べ」',
    weight: 6,
    once: true,
    condition: (ctx) => (ctx.flags.gundan ?? 0) >= 2,
    choices: (ctx): EventChoice[] => [
      {
        label: '正式に入る',
        effect: {},
        result: '',
        endRun: {
          ending: 'GUNDAN',
          text: `${year(ctx)}年、軍団に入った。毎朝、割り当てられた番号で並び、指示された台に座る。もう期待値を計算する必要はない。計算するのは、別の誰かだ。`,
        },
      },
      { label: '縁を切る', effect: { mental: -6, hallMark: 10 }, result: '次の日から、抽選の列で視線を感じるようになった。', setFlags: { gundan: -2 } },
    ],
  },
  {
    id: 'hall_staff_offer',
    speaker: '店長',
    text: '閉店後、店長に呼び止められた。「あんた、客の動きがよく見えてるよな。……うちで働かないか。打つ側の気持ちが分かる人間が欲しいんだ」',
    weight: 4,
    once: true,
    condition: (ctx) => ctx.player.hallMark >= 45 && ctx.player.socialCredit >= 30,
    choices: [
      {
        label: '受ける',
        effect: {},
        result: '',
        endRun: {
          ending: 'HALL_STAFF',
          text: 'ホールの店員になった。インカムを付けて島を歩く。かつての自分と同じ目をした客が、データカウンターを見上げている。設定を入れるのは、今は自分だ。',
        },
      },
      { label: '断る', effect: { hallMark: -10, mental: -2 }, result: '店長は「そうか」とだけ言って、シャッターを下ろした。' },
    ],
  },

  // ============================================================
  // 足を洗う（求人チラシ）
  // ============================================================
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
        result: '',
        endRun: {
          ending: 'JOB',
          text:
            ctx.player.cash > 0
              ? `${year(ctx)}年、パチスロを辞めた。収支表は最後の行を書かずに閉じた。期待値の外側にも、生活はあった。`
              : '何もかも失ってから、ようやく辞められた。',
        },
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
