// ============================================================
// 時代・規制
// ============================================================

export type EraId = 'era_5th_early' | 'era_5th_golden' | 'era_6th_early' | 'era_smaslot';

export interface Era {
  id: EraId;
  name: string;
  start: string; // YYYY-MM-DD（含む）
  end: string; // YYYY-MM-DD（含む）
  description: string;
}

/** 日付から決まるホール環境。規制ニュースの累積で変化する */
export interface Environment {
  era: Era;
  /** 1枚あたりの交換単価（円）。貸しは常に20円/枚。20.0 = 等価 */
  exchangeRate: number;
  /** 告知イベントが合法か（2011年の広告規制以降は「匂わせ」のみ） */
  eventsAllowed: boolean;
  /** 店の設定配分の甘さ（1.0 = 基準） */
  generosity: number;
  /** 軍団・設定師の多さ（0〜1）。抽選倍率と高設定の先取り精度に効く */
  crowdPressure: number;
  /** ハイエナの期待値（枚/時）。拾える台がない時間も含めた1日平均。時代とともに枯れていく */
  hyenaCoinsPerHour: number;
  /** 物価指数（2008年=1.00）。食費など日々の出費に掛かる */
  priceIndex: number;
  /** 月初の固定費（家賃・光熱通信・国保年金） */
  monthlyFixedCost: number;
}

export interface RegulationNews {
  date: string;
  headline: string;
  body: string;
  apply: Partial<Omit<Environment, 'era'>>;
}

// ============================================================
// 機種
// ============================================================

export type MachineType = 'A_TYPE' | 'AT_HIGH_SPEC' | 'SMASLOT' | 'TECH';

/**
 * 抽選される役（ボーナス・AT初当り・小役・示唆・プレミア）。payout は1回あたりの平均獲得枚数。
 * - NORMAL: 通常の役
 * - HINT: 設定示唆・確定演出（出玉なし）。分母に Infinity を入れた設定では出現しない＝その設定を否定する
 * - PREMIUM: フリーズ等のプレミアフラグ（大量出玉）
 */
export type FlagKind = 'NORMAL' | 'HINT' | 'PREMIUM';

/** プレミア・確定演出が出たときの画面演出 */
export type PremiumStyle = 'FREEZE' | 'BLACKOUT' | 'CONFIRM';

export interface Flag {
  key: string;
  label: string;
  /** 設定1〜6の分母（1/x の x）。Infinity はその設定で出現しない */
  denominators: [number, number, number, number, number, number];
  payout: number;
  /** 1回あたり獲得枚数の標準偏差（AT/ARTの出玉ムラ）。固定払い出しなら0 */
  payoutSd: number;
  /** カウント・判別の対象か */
  countable: boolean;
  kind?: FlagKind;
  /** 出現時の描写（示唆・プレミア） */
  text?: string;
  /** 示唆の意味として世間で言われていること（例: 「設定4以上濃厚」）。偽物示唆では誇張されている */
  meaning?: string;
  /**
   * 解析で確率が判明しているか。false は「噂」レベルで、自作の判別ツールに入らない。
   * 偽物示唆（意味ありげだが設定差がほぼない）はここが false
   */
  published?: boolean;
  style?: PremiumStyle;
}

export interface Machine {
  id: string;
  name: string;
  maker: string;
  type: MachineType;
  /** 導入日・撤去日（YYYY-MM-DD） */
  release: string;
  retire: string;
  /** 設定1〜6の機械割（%） */
  payoutRates: [number, number, number, number, number, number];
  flags: Flag[];
  /** 1時間あたりの消化ゲーム数 */
  gamesPerHour: number;
  /** ホールでの設置比率の重み */
  shareWeight: number;
}

// ============================================================
// ホール
// ============================================================

export type ParlorSize = 'BIG' | 'MID' | 'SMALL';

/** 店の「強い日」の決まり（プレイヤーには見えない。データと告知から推理する） */
export type StrongDayRule =
  | { kind: 'TAIL'; digit: number } // 末尾の日（7のつく日など）
  | { kind: 'ZOROME' } // 11日・22日
  | { kind: 'WEEKDAY'; day: number } // 毎週○曜日
  | { kind: 'MONTH_START' } // 月初1日
  | { kind: 'NONE' };

/** 強い日の高設定の入れ方 */
export type Placement = 'ALL_MODEL' | 'LINE' | 'TAIL_NUMBER' | 'CORNER' | 'SCATTER';

/**
 * 人生ごとにランダムに生成される店。癖（強い日・入れ方・据え置き・凹み上げ・告知の正直さ・軍団との癒着）は隠れている
 */
export interface ParlorProfile {
  id: string;
  name: string;
  size: ParlorSize;
  /** 誰でも知っている表向きの評判 */
  description: string;
  unitCount: number;
  baseQueue: number;
  /** 通常日に高設定（4〜6）が入る台の割合 */
  normalHighRate: number;
  strongDay: StrongDayRule;
  /** 強い日に高設定が入る台の割合（入れ方が SCATTER のとき） */
  strongHighRate: number;
  placement: Placement;
  /** 前日の設定の据え置き率 */
  carryOverRate: number;
  /** 前日いちばん凹んだ台の設定を上げる癖 */
  dentedRaise: boolean;
  /** 告知・匂わせが本当である確率（低い店は煽るだけ） */
  honesty: number;
  /** 軍団と癒着している（高設定は抽選で先に軍団へ流れる） */
  gundanTie: boolean;
}

/** 店からの告知・匂わせ（その日の入れ方を示す、ことになっている） */
export interface ParlorNotice {
  /** どこで見たか（看板・ブログ・X・取材） */
  medium: string;
  text: string;
  /** 示している入れ方と機種（嘘の場合もある） */
  placement: Placement;
  machineId?: string;
  digit?: number;
}

/** データカウンターに表示されるデータ */
export interface CounterData {
  games: number;
  counts: Record<string, number>;
  coinDiff: number;
}

export interface FloorUnit {
  unitNo: number;
  machineId: string;
  /** 真の設定。プレイヤーには見えない */
  setting: number;
  /** 島の端（角台） */
  corner: boolean;
  yesterday: CounterData;
  takenBy: 'NONE' | 'OTHER' | 'PLAYER';
  /** 他の客がその日に打ち切ったときの最終データ（プレイヤーには時刻に応じた途中経過しか見えない） */
  closing: CounterData;
  /** 他の客が席を立つ時刻（分）。以降は空き台（ヤメ台）になる */
  quitAt: number;
}

/** 閉店後のデータ（店ごとに保存し、PCで見返す） */
export interface DaySnapshot {
  date: string;
  notice: string | null;
  /** [台番, 機種番号, G数, ボーナス1, ボーナス2, 差枚] */
  units: [number, number, number, number, number, number][];
}

// ============================================================
// 1日の進行
// ============================================================

/**
 * 1ターン = 1週間。
 * WEEK_PLAN（方針決め）→ 自動稼働 →［勝負日: FLOOR → PLAYING → LEDGER］→ 自動稼働 → WEEK_END
 */
export type Phase = 'TITLE' | 'WEEK_PLAN' | 'FLOOR' | 'PLAYING' | 'LEDGER' | 'WEEK_END' | 'GAME_OVER';

export type Lifestyle = 'COOK' | 'CONVENIENCE' | 'SENTO';

/** おまかせ稼働の台の選び方（プレイヤーが推理した店の癖を反映する） */
export type PickRule = 'NOTICE' | 'CARRY' | 'DENTED' | 'CORNER' | 'TAIL';

/** SETTING: 毎日設定狙い / TARGET: 告知・狙い日だけ設定狙い、他の日はハイエナ / HYENA: ハイエナ中心 */
export type WorkStyle = 'SETTING' | 'TARGET' | 'HYENA';

/** 週の方針 */
export interface WeekPlan {
  lifestyle: Lifestyle;
  /** おまかせ稼働で通う店 */
  parlorId: string;
  style: WorkStyle;
  /** おまかせで台を選ぶときの狙い方 */
  pickRule: PickRule;
  /** 勝負日を含む稼働日数 */
  workDays: 5 | 6 | 7;
  /** 手動で打つ勝負日（なしなら全日おまかせ） */
  shoubu: { date: string; parlorId: string } | null;
}

/** 週の締めに表示する集計 */
export interface WeekSummary {
  start: string;
  end: string;
  workDays: number;
  expectedValue: number;
  actualProfit: number;
  /** フリーズ・確定演出など、おまかせ稼働中の出来事 */
  highlights: string[];
  /** 月初の引き落としなど */
  notices: string[];
}

export type ActionType = 'SETTING' | 'HYENA' | 'TECH' | 'REST';

export interface PlaySession {
  unitNo: number | null;
  machineId: string | null;
  /** 座った台の真の設定。プレイヤーには見えない */
  unitSetting: number | null;
  actionType: ActionType;
  games: number;
  counts: Record<string, number>;
  /** 直近1時間の役の成立回数（ランプ演出用） */
  lastCounts: Record<string, number>;
  /** 直近1時間の差枚（上振れ演出用） */
  lastDiff?: number;
  /** 差枚（実測） */
  coinDiff: number;
  /** 手持ちの遊技メダル */
  coinsInHand: number;
  /** 現金投資額（円） */
  cashInvested: number;
  /** 積んだ期待差枚 */
  expectedCoins: number;
  /** 理論上の差枚分散（σ²の累積） */
  coinVariance: number;
  /** 経過時刻（分、0:00起点） */
  clock: number;
  log: string[];
}

export interface Today {
  parlorId: string;
  lotteryNumber: number;
  queueSize: number;
  /** 今日の告知・匂わせ */
  notice: ParlorNotice | null;
  floor: FloorUnit[];
  session: PlaySession | null;
  /** 台移動する前に打っていたセッション */
  pastSessions: PlaySession[];
  /** 打っている最中に起きた出来事（選択待ち） */
  floorEvent: FloorEvent | null;
}

/** 勝負日に打っている最中に起きる出来事 */
export type FloorEvent =
  | { kind: 'YAME'; unitNo: number } // 島の台が空いた
  | { kind: 'NEIGHBOR_CONFIRM'; unitNo: number; label: string; meaning: string } // 隣が確定演出を出して席を立った
  | { kind: 'BUYOUT'; price: number } // 軍団に台を売ってくれと言われる
  | { kind: 'STAFF' }; // 店員が台番をメモしている

export interface DayLog {
  date: string;
  era: EraId;
  actionType: ActionType;
  parlorName: string;
  machineName: string;
  gamesPlayed: number;
  /** 記帳した期待値（円）。小役カウンターからの設定推測に基づく自己推定 */
  expectedValue: number;
  /** 実収支（円） */
  actualProfit: number;
  /** 推定設定に基づく標準偏差（円） */
  sigma: number;
  /** 投資額（円） */
  cashInvested: number;
  /** 判別ツールの事後平均による推定設定（設定狙い以外は null） */
  estimatedSetting: number | null;
  /** 真の期待値（円）。プレイヤーには見えない。ゲームオーバー時の答え合わせ用 */
  trueExpectedValue: number;
  /** 真の設定。プレイヤーには見えない。ゲームオーバー時の答え合わせ用 */
  trueSetting: number | null;
  memo: string;
}

export interface PlayerStats {
  cash: number; // 現金
  bankSavings: number; // 銀行預金
  health: number; // 体力 (0-100)
  mental: number; // 精神 (0-100)
  hallMark: number; // 店マーク度 (0-100)
  socialCredit: number; // 社会信用度 (0-100)
  currentDate: string; // YYYY-MM-DD
  debt: number; // 消費者金融からの借入残高
}


// ============================================================
// ローグライク要素
// ============================================================

/** 人生ごとにランダムに提示される出自 */
export interface Trait {
  id: string;
  name: string;
  description: string;
  intro: string;
  stats: Pick<PlayerStats, 'cash' | 'health' | 'mental' | 'socialCredit'>;
  /** 毎月1日に加算される収支（仕送り +、借金返済 −） */
  monthlyDelta: number;
}

export type StatDelta = Partial<Pick<PlayerStats, 'cash' | 'health' | 'mental' | 'hallMark' | 'socialCredit'>>;

export interface EventChoice {
  label: string;
  effect: StatDelta;
  result: string;
  /** 選ぶと人生が終わる（足を洗う等） */
  endRun?: { ending: EndingId; text: string };
  /** 物語の進行フラグを加算する */
  setFlags?: Record<string, number>;
}

export interface EventContext {
  player: PlayerStats;
  date: Date;
  env: Environment;
  /** 物語の進行フラグ（例: father=1 は父が入院した） */
  flags: Record<string, number>;
  /** フラグが立った日（例: father → 2013-05-01） */
  flagDates: Record<string, string>;
}

export interface GameEvent {
  id: string;
  speaker: string;
  text: string | ((ctx: EventContext) => string);
  weight: number;
  once?: boolean;
  condition: (ctx: EventContext) => boolean;
  choices: EventChoice[] | ((ctx: EventContext) => EventChoice[]);
}

/** 墓標（過去の人生の記録） */
export interface RunRecord {
  id: string;
  traitName: string;
  startDate: string;
  endDate: string;
  workDays: number;
  finalCash: number;
  totalEv: number;
  totalTrueEv: number;
  totalActual: number;
  reason: string;
  /** この人生で得た記憶ポイント */
  pointsEarned: number;
  ending: EndingId;
}

/** 人生の終わり方 */
export type EndingId =
  | 'BANKRUPT' // 破産
  | 'BROKEN_BODY' // 体が壊れる
  | 'BROKEN_MIND' // 心が折れる
  | 'JOB' // 足を洗って就職
  | 'HALL_STAFF' // ホール店員になる
  | 'GUNDAN' // 軍団に入る
  | 'HOMETOWN' // 実家に帰る
  | 'SURVIVOR' // 2026年まで打ち続けた
  | 'LEGEND'; // 2026年まで打ち続け、大きく勝ち越した

export interface Ending {
  id: EndingId;
  title: string;
}

/** 人生をまたいで引き継ぐ知識（前世の記憶） */
export type LegacyPerkId = 'HINT_INSIGHT' | 'PARLOR_HABIT' | 'AUTO_JUDGE' | 'EMERGENCY_FUND' | 'BODY_MEMORY' | 'THICK_SKIN';

export interface LegacyPerk {
  id: LegacyPerkId;
  name: string;
  description: string;
  cost: number;
}
