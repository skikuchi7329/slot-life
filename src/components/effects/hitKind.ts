import type { Machine } from '../../types';

export type HitKind = 'PEKA' | 'PUSH' | 'HOT';

export function hitKindFor(machine: Machine, lastCounts: Record<string, number>, lastDiff: number): HitKind | null {
  const bonus = machine.flags.some((f) => (f.kind ?? 'NORMAL') === 'NORMAL' && f.payout > 8 && (lastCounts[f.key] ?? 0) > 0);
  if (!bonus) return null;
  if (lastDiff >= 1500) return 'HOT';
  return machine.type === 'A_TYPE' || machine.type === 'TECH' ? 'PEKA' : 'PUSH';
}
