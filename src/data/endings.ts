import type { Ending, EndingId } from '../types';

/** 人生の終わり方。墓標で集めていく */
export const ENDINGS: Ending[] = [
  { id: 'BANKRUPT', title: '破産' },
  { id: 'BROKEN_BODY', title: '体が壊れた' },
  { id: 'BROKEN_MIND', title: '心が折れた' },
  { id: 'JOB', title: '足を洗った' },
  { id: 'HALL_STAFF', title: 'ホールの向こう側へ' },
  { id: 'GUNDAN', title: '軍団の一員' },
  { id: 'HOMETOWN', title: '実家に帰った' },
  { id: 'SURVIVOR', title: '2026年まで打ち続けた' },
  { id: 'LEGEND', title: '伝説の専業' },
];

export function endingTitle(id: EndingId | undefined): string {
  return ENDINGS.find((e) => e.id === id)?.title ?? '破産';
}
