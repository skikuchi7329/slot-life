import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DaySnapshot } from '../types';

/** 店ごとに保存しておく閉店後データの日数 */
const KEEP_DAYS = 21;

/** データサイト（全店の毎日のデータがネットで見られる）が普及した日 */
export const DATA_SITE_DATE = '2015-01-01';

interface ShopDataState {
  /** 店ID → 閉店後データ（新しい順） */
  data: Record<string, DaySnapshot[]>;
  record: (parlorId: string, snapshot: DaySnapshot) => void;
  clear: () => void;
}

/**
 * 閉店後のデータ。店の癖（強い日・全台系・並び・末尾・角）を推理する材料。
 * データサイト以前は自分が行った店の日しか残らない。
 */
export const useShopDataStore = create<ShopDataState>()(
  persist(
    (set) => ({
      data: {},
      record: (parlorId, snapshot) =>
        set((s) => {
          const prev = (s.data[parlorId] ?? []).filter((d) => d.date !== snapshot.date);
          return { data: { ...s.data, [parlorId]: [snapshot, ...prev].slice(0, KEEP_DAYS) } };
        }),
      clear: () => set({ data: {} }),
    }),
    { name: 'slot-life-shopdata', version: 1 },
  ),
);
