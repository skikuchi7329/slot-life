import { useEffect, useState } from 'react';
import type { Machine } from '../../types';
import type { HitKind } from './hitKind';
import { playHot, playPeka, playPush } from '../../utils/audio';
import { cn } from '../../utils/cn';
import { num } from '../../utils/format';

/**
 * 当たり・上振れの演出。1時間ぶんの結果をまとめて見せる。
 * - Aタイプ：GOGOランプのペカリ（ハナハナ系はサイドランプの色）
 * - AT機：PUSHボタンを押すと結果が出る。大きく出た時間は虹色の激アツ演出
 * 演出は結果を変えない。分散がこちらに転んだことを、少しだけ祝うだけだ。
 */
const SIDE_LAMP = ['#4aa3ff', '#ffd23a', '#3ad16b', '#ff4a4a'];

function Pekari({ machine, lastCounts, onDone }: { machine: Machine; lastCounts: Record<string, number>; onDone: () => void }) {
  const hana = machine.id.startsWith('hibiscus') || machine.id === 'houou';
  const color = hana ? SIDE_LAMP[Object.values(lastCounts).reduce((a, b) => a + b, 0) % SIDE_LAMP.length] : '#ff3d6e';
  const hits = machine.flags.filter((f) => f.kind !== 'HINT' && f.kind !== 'PREMIUM' && f.payout > 8 && (lastCounts[f.key] ?? 0) > 0);
  useEffect(() => {
    playPeka();
    const id = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <button type="button" className="absolute inset-0 z-[15] cursor-pointer" onClick={onDone}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="lamp absolute top-[260px] left-[548px] h-[90px] w-[90px] rounded-full"
        style={{ background: color, boxShadow: `0 0 60px 30px ${color}` }}
      />
      <div
        className="absolute top-[250px] left-[680px] text-[64px] tracking-widest"
        style={{ color, textShadow: `0 0 20px ${color}` }}
      >
        {hana ? '★' : 'GOGO!'}
      </div>
      <div className="absolute top-[340px] left-[680px] text-[26px] text-neutral-100">
        {hits.map((f) => `${f.label}×${lastCounts[f.key]}`).join('  ')}
      </div>
    </button>
  );
}

function PushButton({ lastDiff, hot, onDone }: { lastDiff: number; hot: boolean; onDone: () => void }) {
  const [pushed, setPushed] = useState(false);
  const press = () => {
    if (pushed) return;
    setPushed(true);
    if (hot) playHot();
    else playPush();
  };
  useEffect(() => {
    if (!pushed) return;
    const id = window.setTimeout(onDone, hot ? 2400 : 1400);
    return () => window.clearTimeout(id);
  }, [pushed, hot, onDone]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'z'].includes(e.key)) {
        e.preventDefault();
        if (pushed) onDone();
        else press();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="absolute inset-0 z-[15]">
      <div className={cn('absolute inset-0', pushed && hot ? 'rainbow-bg' : 'bg-black/60')} />
      {!pushed ? (
        <button type="button" onClick={press} className="absolute top-[200px] left-1/2 -translate-x-1/2 text-center">
          <div className="lamp mx-auto flex h-[170px] w-[170px] items-center justify-center rounded-full border-[10px] border-[#7a0d12] bg-[#e0202a] text-[46px] text-white shadow-[0_10px_0_#5a0a0e,0_0_50px_rgb(255_40_40/0.6)]">
            PUSH
          </div>
          <div className="mt-4 text-[20px] text-neutral-300">ボタンを押せ</div>
        </button>
      ) : (
        <button type="button" onClick={onDone} className="absolute top-[180px] left-1/2 -translate-x-1/2 text-center">
          <div className={cn('text-[72px] tracking-widest', hot ? 'text-white' : 'text-amber-300')} style={{ textShadow: '0 0 24px rgb(0 0 0 / 0.8)' }}>
            {hot ? '激アツ' : 'AT突入'}
          </div>
          <div className="mt-2 text-[44px] text-white tabular-nums" style={{ textShadow: '0 0 16px rgb(0 0 0 / 0.9)' }}>
            {lastDiff >= 0 ? '+' : ''}
            {num(lastDiff)}枚
          </div>
        </button>
      )}
    </div>
  );
}

export function HitEffect({ kind, machine, lastCounts, lastDiff, onDone }: { kind: HitKind; machine: Machine; lastCounts: Record<string, number>; lastDiff: number; onDone: () => void }) {
  if (kind === 'PEKA') return <Pekari machine={machine} lastCounts={lastCounts} onDone={onDone} />;
  return <PushButton lastDiff={lastDiff} hot={kind === 'HOT'} onDone={onDone} />;
}
