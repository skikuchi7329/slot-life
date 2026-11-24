/**
 * 効果音。音源ファイルは使わず Web Audio で合成する。
 * ミュート設定はブラウザに保存する（失敗しても音が鳴らないだけ）。
 */

let ctx: AudioContext | null = null;
const MUTE_KEY = 'slot-life-muted';

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // 保存できなくても動作に影響はない
  }
}

function audio(): AudioContext | null {
  if (isMuted()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.12) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** ペカッ（GOGOランプ点灯） */
export function playPeka() {
  tone(1568, 0, 0.18, 'square', 0.06);
  tone(2093, 0.06, 0.35, 'sine', 0.1);
}

/** PUSHボタン */
export function playPush() {
  tone(220, 0, 0.08, 'square', 0.08);
  tone(880, 0.05, 0.12, 'triangle', 0.08);
}

/** 激アツ（上昇音） */
export function playHot() {
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, 'square', 0.05));
}

/** フリーズ・暗転（低い持続音） */
export function playFreeze() {
  tone(55, 0, 2.2, 'sawtooth', 0.05);
  tone(82, 0.2, 2.0, 'sine', 0.06);
}

/** 確定演出（澄んだ和音） */
export function playConfirm() {
  [1047, 1319, 1568].forEach((f) => tone(f, 0, 1.4, 'sine', 0.06));
}
