import type { Machine } from '../types';
import { binomialLogLik, randNormal, sampleBinomial } from '../utils/math';

/** 貸メダル単価（円/枚）。1000円 = 50枚 */
export const LEND_RATE = 20;
export const COINS_PER_1000_YEN = 50;
export const BET_PER_GAME = 3;

/** 設定ごとの1Gあたり期待差枚: 3枚 × (機械割 - 1) */
export function expectedCoinsPerGame(machine: Machine, setting: number): number {
  return BET_PER_GAME * (machine.payoutRates[setting - 1] / 100 - 1);
}

/**
 * 1Gあたり差枚の分散。
 * 各役は独立なベルヌーイ試行（確率 p、獲得 x、獲得ムラ s）とみなし Var = p(1-p)x² + p·s² の和。
 * ベース（リプレイ等）は決定的な払い出しとして扱うので分散に寄与しない。
 */
export function coinVariancePerGame(machine: Machine, setting: number): number {
  return machine.flags.reduce((acc, f) => {
    const p = 1 / f.denominators[setting - 1];
    return acc + p * (1 - p) * f.payout ** 2 + p * f.payoutSd ** 2;
  }, 0);
}

/** 機械割に一致させるためのベース払い出し（枚/G） */
function baseReturnPerGame(machine: Machine, setting: number): number {
  const totalReturn = BET_PER_GAME * (machine.payoutRates[setting - 1] / 100);
  const flagReturn = machine.flags.reduce((acc, f) => acc + f.payout / f.denominators[setting - 1], 0);
  return totalReturn - flagReturn;
}

export interface GamesResult {
  games: number;
  counts: Record<string, number>;
  coinDiff: number;
  expectedCoins: number;
  variance: number;
}

/**
 * 1回の当りの獲得枚数。平均 x・標準偏差 s の対数正規分布で引く。
 * AT/ARTの「大半は単発、たまに万枚」という右に裾の長い出玉分布を再現し、負の出玉も生じない。
 */
function samplePayout(mean: number, sd: number): number {
  if (sd === 0) return mean;
  const sigma2 = Math.log(1 + (sd / mean) ** 2);
  return Math.exp(Math.log(mean) - sigma2 / 2 + Math.sqrt(sigma2) * randNormal());
}

/**
 * n ゲームを消化する。
 * 各役の当選回数 k ~ B(n, p) を引き、当りごとに出玉を引いて合算する。
 * 合算すると 差枚 = 期待差枚 + σ·Z（中心極限）となり、期待値どおりにならない下振れがそのまま現れる。
 */
export function simulateGames(machine: Machine, setting: number, games: number): GamesResult {
  const counts: Record<string, number> = {};
  let coinDiff = games * (baseReturnPerGame(machine, setting) - BET_PER_GAME);
  for (const f of machine.flags) {
    const k = sampleBinomial(games, 1 / f.denominators[setting - 1]);
    counts[f.key] = k;
    if (f.payoutSd === 0) {
      coinDiff += k * f.payout;
    } else {
      for (let i = 0; i < k; i++) coinDiff += samplePayout(f.payout, f.payoutSd);
    }
  }
  return {
    games,
    counts,
    coinDiff: Math.round(coinDiff),
    expectedCoins: expectedCoinsPerGame(machine, setting) * games,
    variance: coinVariancePerGame(machine, setting) * games,
  };
}

/**
 * 判別に使える役。データカウンターに出るボーナス・AT初当りと、目で見える示唆・プレミアはいつでも数えられる。
 * ブドウ等の小役は、小役カウンターを持っているときだけ数えられる（ADR-025）。
 */
export function judgedFlags(machine: Machine, handCounter: boolean) {
  return machine.flags.filter(
    (f) => f.countable && f.published !== false && (handCounter || (f.kind ?? 'NORMAL') !== 'NORMAL' || f.payout > 8),
  );
}

/**
 * 小役カウンター・示唆の数値から設定ごとの事後確率を求める。
 * 専業がExcelで回している判別ツールと同じ二項尤度ベースの計算。
 * 解析で確率が判明していない「噂」の示唆（published: false）は入らない。
 * prior を省略（undefined）すると一様事前分布（記帳用の判別ツールはこちら。ADR-007）。
 */
export function settingPosterior(machine: Machine, games: number, counts: Record<string, number>, prior?: number[], handCounter = true): number[] {
  const flags = judgedFlags(machine, handCounter);
  const logLik = [1, 2, 3, 4, 5, 6].map(
    (s) =>
      flags
        .reduce((acc, f) => acc + binomialLogLik(counts[f.key] ?? 0, games, 1 / f.denominators[s - 1]), 0) +
      (prior ? Math.log(prior[s - 1]) : 0),
  );
  const max = Math.max(...logLik);
  const w = logLik.map((l) => Math.exp(l - max));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

export interface CounterEstimate {
  expectedCoins: number;
  variance: number;
  /** 事後平均の設定（例: 3.4） */
  meanSetting: number;
}

/**
 * 専業が夜に記帳する「推定期待値」。真の設定は誰にも分からないので、
 * 判別ツールの事後確率で各設定の期待差枚・分散を重み付けする。
 * 一様事前分布のため、データが少ないほど高設定側に楽観的になる。
 */
export function estimateFromCounters(machine: Machine, games: number, counts: Record<string, number>, handCounter = true): CounterEstimate {
  const posterior = settingPosterior(machine, games, counts, undefined, handCounter);
  return posterior.reduce<CounterEstimate>(
    (acc, p, i) => ({
      expectedCoins: acc.expectedCoins + p * expectedCoinsPerGame(machine, i + 1) * games,
      variance: acc.variance + p * coinVariancePerGame(machine, i + 1) * games,
      meanSetting: acc.meanSetting + p * (i + 1),
    }),
    { expectedCoins: 0, variance: 0, meanSetting: 0 },
  );
}

/**
 * 差枚を円に換算する。
 * 円収支 = 交換率 × 差枚 − 現金投資 × (1 − 交換率/貸単価)
 * 第2項が非等価の「交換ギャップ」。等価(20円)なら0になる。
 */
export function coinsToYen(coinDiff: number, cashInvested: number, exchangeRate: number): number {
  return exchangeRate * coinDiff - cashInvested * (1 - exchangeRate / LEND_RATE);
}
