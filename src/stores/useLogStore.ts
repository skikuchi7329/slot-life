import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DayLog } from '../types';

interface LogState {
  logs: DayLog[];
  append: (log: DayLog) => void;
  clear: () => void;
}

export const useLogStore = create<LogState>()(
  persist(
    (set) => ({
      logs: [],
      append: (log) => set((s) => ({ logs: [...s.logs, log] })),
      clear: () => set({ logs: [] }),
    }),
    {
      name: 'slot-life-log',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as LogState;
        // v1 は真の期待値をそのまま記帳していた。推定値は復元できないので同値で埋める
        if (version < 2) {
          state.logs = state.logs.map((l) => ({
            ...l,
            estimatedSetting: l.estimatedSetting ?? null,
            trueExpectedValue: l.trueExpectedValue ?? l.expectedValue,
          }));
        }
        return state;
      },
    },
  ),
);
