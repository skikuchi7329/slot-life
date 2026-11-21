import type { Palette } from './Pixel';

// ============================================================
// 人物
// ============================================================

/** 主人公（後ろ姿・着席） 12×16 */
export const HERO_BACK = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '.hhhhhhhhhh.',
  '.hhhhhhhhhh.',
  '.hhhhhhhhhh.',
  '..hhhhhhhh..',
  '...hsssssh..',
  '..gggggggg..',
  '.gggggggggg.',
  'ggggddddgggg',
  'gggggggggggg',
  'gggggggggggg',
  'gggggggggggg',
  'dggggggggggd',
  'dggggggggggd',
  '.dddddddddd.',
];
export const HERO_PALETTE: Palette = { h: '#16110d', s: '#b98d70', g: '#5d6170', d: '#454856' };

/** 並び客（立ち姿） 5×10 */
export const QUEUE_PERSON = ['.hhh.', '.hhh.', '.sss.', 'ccccc', 'ccccc', 'ccccc', 'ccccc', '.ccc.', '.l.l.', '.l.l.'];

/** 着席客（後ろ姿・小） 8×9 */
export const SEATED_PERSON = ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '..hssh..', '.cccccc.', 'cccccccc', 'cccccccc', 'cccccccc', 'cccccccc'];

export const COAT_COLORS = ['#3b3f4c', '#4a3b3b', '#2f4038', '#47423a', '#363a52', '#52463a', '#2c2c30'];

// ============================================================
// スロット筐体（正面） 14×29
// ============================================================

export const CABINET = [
  'kkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkk',
  '..............',
  '.tttttttttttt.',
  '.tLttttttttLt.',
  '.tttttttttttt.',
  '.bbbbbbbbbbbb.',
  '.bwwwwwwwwwwb.',
  '.bwrwwnwwrwwb.',
  '.bwrwwnwwrwwb.',
  '.bwwwwwwwwwwb.',
  '.bbbbbbbbbbbb.',
  '.bbgbbbbbbbbb.',
  '.bbbbbbbbbbbb.',
  '.bkkkkkkkkkkb.',
  '.bkoookkkkkkb.',
  '.bbbbbbbbbbbb.',
  '.bbbbbbbbbbbb.',
  '.bmmmmmmmmmmb.',
  '.bmmmmmmmmmmb.',
  '.bbbbbbbbbbbb.',
  '.bbbbbbbbbbbb.',
  '.bbbbbbbbbbbb.',
  '..dddddddddd..',
  '..dddddddddd..',
  '....ssssss....',
  '.....s..s.....',
];

const CABINET_BASE: Palette = {
  k: '#050505',
  w: '#e8e6dc',
  r: '#c2222b',
  n: '#1e2a55',
  o: '#c9c9c9',
  m: '#9aa0a6',
  d: '#1b1b1f',
  s: '#3a3a40',
};

/** 機種タイプごとの筐体色 */
export function cabinetPalette(type: string, lampOn: boolean): Palette {
  const body: Record<string, { b: string; t: string; L: string }> = {
    A_TYPE: { b: '#d8d2c2', t: '#e46aa0', L: '#f3c64a' },
    TECH: { b: '#b8954a', t: '#6a4a1a', L: '#f2e27a' },
    AT_HIGH_SPEC: { b: '#6e2530', t: '#2a0d12', L: '#e0a43a' },
    SMASLOT: { b: '#26346e', t: '#0f1530', L: '#7ad0ff' },
  };
  const c = body[type] ?? body.A_TYPE;
  return { ...CABINET_BASE, ...c, g: lampOn ? '#ff3d6e' : '#4a2a33' };
}
