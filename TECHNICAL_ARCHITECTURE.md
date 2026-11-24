# 技術設計書

## 1. 推奨技術スタック

Claude Code ProPlanの自律実装に最適化し、外部依存を最小限に抑えたモダンなフロントエンド構成とする。

* **Framework**: React 19 + TypeScript (Vite)
* **Styling**: Tailwind CSS + Lucide React（アイコン）
* **State Management**: Zustand (永続化: `persist` ミドルウェアでLocalStorage保存)
* **Audio**: Web Audio API（シンセサイズによるSE生成、またはフリー音源）
* **Data Visualization**: Recharts（収支グラフ、期待値乖離グラフの描画）
* **Hosting**: GitHub Pages（`main` へのプッシュで GitHub Actions が lint → build → 公開。`.github/workflows/deploy.yml`、本番の `base` は `/slot-life/`。ADR-024）

## 2. ディレクトリ構成

設計判断の経緯は `docs/DECISIONS.md` を参照（UI 構成は ADR-009、ストア分割は ADR-011、週単位の進行は ADR-013、店の癖は ADR-018）。

```text
src/
├── components/
│   ├── game/            # Stage（1280×720固定）、Hud、MessageWindow（会話＋選択肢）、Pixel（SVGドット絵）、sprites
│   ├── effects/         # 当たり演出（ペカリ・PUSH・激アツ）
│   ├── scenes/          # ドット絵シーン：Title / Room / Queue / Floor / Machine
│   ├── phases/          # フェーズ単位の画面：Title / WeekPlan / Floor / Play / ShoubuNight / WeekEnd / GameOver
│   ├── parlor/          # ホールで使う部品（データの帯、告知カード）
│   └── pc/              # 部屋のPCで開く表計算ソフト窓（収支表・グラフ・答え合わせ・墓標・店のデータ・店舗別）
├── data/
│   ├── eras.ts          # 時代区分と規制ニュース（getEnvironment）
│   ├── machines.ts      # 機種データ（機械割、役の確率・出玉）
│   ├── parlors.ts       # 人生ごとの店の生成（隠れた癖）
│   ├── events.ts        # 突発イベント（選択肢つき）
│   ├── traits.ts        # 出自（ローグライクの初期条件）
│   ├── endings.ts       # エンディング
│   └── legacy.ts        # 前世の記憶（人生をまたぐ引き継ぎ）
├── engine/
│   ├── simulation.ts    # 遊技シミュレーション、設定判別（ベイズ推定）、円換算
│   ├── session.ts       # 遊技セッション（1時間ずつ進める、記帳用の DayLog 生成）
│   ├── autoplay.ts      # おまかせ稼働の1日（台選び・見切り・台移動）
│   ├── floorEvents.ts   # 勝負日に島で起きる出来事
│   └── floor.ts         # 島の構成・設定の割り当て・告知・抽選・他の客の打ち方・閉店後データ
├── hooks/
│   └── useTypewriter.ts # 文字送り
├── stores/
│   ├── useGameStore.ts  # 進行中の人生と週の進行（永続化）
│   ├── useLogStore.ts   # 収支表（永続化）
│   ├── useRunStore.ts   # 墓標＝過去の人生と前世の記憶（永続化・人生をまたぐ）
│   ├── useShopDataStore.ts # 店ごとの閉店後データ（永続化・人生ごとにリセット）
│   └── useUiStore.ts    # PC窓など一時的なUI状態（永続化しない）
├── types/
│   └── index.ts         # 型定義
└── utils/
    ├── math.ts          # 正規乱数（Box-Muller）、二項分布、尤度、シード付き乱数
    ├── format.ts        # 円・枚数・日付の表示
    ├── audio.ts         # 効果音（Web Audio で合成）
    └── cn.ts            # clsx + tailwind-merge
```


export type EraId = 'era_5th_early' | 'era_5th_golden' | 'era_6th_early' | 'era_smaslot';

export interface Machine {
  id: string;
  name: string;
  type: 'A_TYPE' | 'AT_HIGH_SPEC' | 'SMASLOT' | 'TECH';
  baseCoinRate: number;      // 1kあたりのベース回転数
  settings: {
    setting: number;
    payoutRate: number;      // 機械割 (例: 104.5)
    variance: number;        // 分散 (標準偏差)
    deductionRate: number;   // 見切り難易度
  }[];
}

export interface DayLog {
  date: string;
  era: EraId;
  actionType: 'SETTING' | 'HYENA' | 'TECH' | 'REST';
  machineName: string;
  gamesPlayed: number;
  expectedValue: number;    // 積んだ期待値
  actualProfit: number;     // 実収支
  memo: string;
}

export interface PlayerStats {
  cash: number;             // 現金
  bankSavings: number;      // 銀行預金
  health: number;           // 体力 (0-100)
  mental: number;           // 精神 (0-100)
  hallMark: number;         // 店マーク度 (0-100)
  socialCredit: number;     // 社会信用度 (0-100)
  currentDate: string;      // YYYY-MM-DD
}
