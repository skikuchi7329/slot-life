import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RunRecord } from '../types';

interface RunState {
  runs: RunRecord[];
  record: (run: RunRecord) => void;
}

/** 墓標。人生をまたいで残る唯一のデータ */
export const useRunStore = create<RunState>()(
  persist(
    (set) => ({
      runs: [],
      record: (run) => set((s) => ({ runs: [...s.runs, run] })),
    }),
    { name: 'slot-life-runs', version: 1 },
  ),
);
