import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LEGACY_PERKS } from '../data/legacy';
import type { LegacyPerkId, RunRecord } from '../types';

interface RunState {
  runs: RunRecord[];
  /** 解放済みの前世の記憶 */
  perks: LegacyPerkId[];
  spentPoints: number;
  record: (run: RunRecord) => void;
  unlock: (id: LegacyPerkId) => void;
}

/** 墓標と前世の記憶。人生をまたいで残る唯一のデータ */
export const useRunStore = create<RunState>()(
  persist(
    (set, get) => ({
      runs: [],
      perks: [],
      spentPoints: 0,
      record: (run) => set((s) => ({ runs: [...s.runs, run] })),
      unlock: (id) => {
        const perk = LEGACY_PERKS.find((p) => p.id === id);
        const { perks, spentPoints } = get();
        if (!perk || perks.includes(id) || availablePoints(get()) < perk.cost) return;
        set({ perks: [...perks, id], spentPoints: spentPoints + perk.cost });
      },
    }),
    {
      name: 'slot-life-runs',
      version: 2,
      // v1 には記憶ポイントの概念がない。過去の人生は1件1ポイントとして扱う
      migrate: (persisted, version) => {
        const s = persisted as Partial<RunState>;
        if (version < 2) {
          return {
            runs: (s.runs ?? []).map((r) => ({ ...r, pointsEarned: r.pointsEarned ?? 1 })),
            perks: [],
            spentPoints: 0,
          } as unknown as RunState;
        }
        return s as RunState;
      },
    },
  ),
);

export function availablePoints(s: Pick<RunState, 'runs' | 'spentPoints'>): number {
  return s.runs.reduce((a, r) => a + r.pointsEarned, 0) - s.spentPoints;
}

export function hasPerk(id: LegacyPerkId): boolean {
  return useRunStore.getState().perks.includes(id);
}
