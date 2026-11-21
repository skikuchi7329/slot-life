/** Box-Muller変換による標準正規乱数 Z ~ N(0, 1) */
export function randNormal(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 期待値 + 標準偏差 × 正規乱数 */
export function sampleNormal(mean: number, sd: number): number {
  return mean + sd * randNormal();
}

/**
 * 二項分布 B(n, p) の標本。
 * np が大きい場合は正規近似（平均 np + √(np(1-p)) × Z）、小さい場合はポアソン近似で厳密寄りに引く。
 */
export function sampleBinomial(n: number, p: number): number {
  const mean = n * p;
  if (mean > 30) {
    return Math.max(0, Math.round(sampleNormal(mean, Math.sqrt(mean * (1 - p)))));
  }
  // Knuthのポアソン法
  const limit = Math.exp(-mean);
  let k = 0;
  let prod = Math.random();
  while (prod > limit) {
    k++;
    prod *= Math.random();
  }
  return k;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 二項分布の対数尤度（定数項は省略）。設定判別のベイズ推定に使う */
export function binomialLogLik(k: number, n: number, p: number): number {
  // 確定演出：その設定では出現しない（p=0）役が出たら、その設定は否定される
  if (p === 0) return k > 0 ? -Infinity : 0;
  return k * Math.log(p) + (n - k) * Math.log(1 - p);
}

/** 日付から決まる擬似乱数（同じ日は同じ天気・同じ並び） */
export function seeded(seed: string, i = 0): number {
  let h = 2166136261 ^ i;
  for (let k = 0; k < seed.length; k++) {
    h ^= seed.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
