import { create } from 'zustand';

export type PcTab = 'LEDGER' | 'CHART' | 'ANSWER' | 'GRAVES' | 'SHOP_DATA' | 'SHOP_STATS';

interface UiState {
  pcTab: PcTab | null;
  openPc: (tab: PcTab) => void;
  closePc: () => void;
}

/** 永続化しない画面状態 */
export const useUiStore = create<UiState>()((set) => ({
  pcTab: null,
  openPc: (tab) => set({ pcTab: tab }),
  closePc: () => set({ pcTab: null }),
}));
