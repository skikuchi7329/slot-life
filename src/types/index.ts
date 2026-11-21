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
  /** ハイエナの期待値（枚/時）。時代とともに枯れていく */
  hyenaCoinsPerHour: number;
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

/** 抽選される役（ボーナス・AT初当り・小役）。payout は1回あたりの平均獲得枚数 */
export interface Flag {
  key: string;
  label: string;
  /** 設定1〜6の分母（1/x の x） */
  denominators: [number, number, number, number, number, number];
  payout: number;
  /** 1回あたり獲得枚数の標準偏差（AT/ARTの出玉ムラ）。固定払い出しなら0 */
  payoutSd: number;
  /** 小役カウンターに表示する判別要素か */
  countable: boolean;
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

export type ParlorKind = 'BIG_EVENT' | 'MID_QUIET' | 'SPECIAL_DAY';

export interface Parlor {
  id: string;
  name: string;
  kind: ParlorKind;
  description: string;
  unitCount: number;
  /** 通常日の並び人数（基準） */
  baseQueue: number;
  /** 通常日の設定配分（設定1〜6の重み） */
  normalWeights: [number, number, number, number, number, number];
  /** 狙い日の設定配分 */
  eventWeights: [number, number, number, number, number, number];
  /** その日が狙い日か */
  isEventDay: (date: Date) => boolean;
  /** 前日設定の据え置き率 */
  carryOverRate: number;
}

/** データカウンターに表示される前日データ */
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
  yesterday: CounterData;
  takenBy: 'NONE' | 'OTHER' | 'PLAYER';
}

// ============================================================
// 1日の進行
// ============================================================

export type Phase = 'TITLE' | 'MORNING' | 'FLOOR' | 'PLAYING' | 'LEDGER' | 'GAME_OVER';

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
  isEventDay: boolean;
  floor: FloorUnit[];
  session: PlaySession | null;
}

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
}

export type NightAction = 'COOK' | 'CONVENIENCE' | 'SENTO' | 'JOB_SITE';

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
  endRun?: string;
}

export interface EventContext {
  player: PlayerStats;
  date: Date;
  env: Environment;
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
}
