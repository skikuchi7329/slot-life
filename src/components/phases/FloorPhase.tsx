import { useState } from 'react';
import { counterFlags, getMachine } from '../../data/machines';
import { getParlor } from '../../data/parlors';
import { OPEN_TIME, useGameStore } from '../../stores/useGameStore';
import type { FloorUnit } from '../../types';
import { num, odds, signedCoins } from '../../utils/format';
import { Hud } from '../game/Hud';
import { MessageWindow } from '../game/MessageWindow';
import { FloorScene } from '../scenes/FloorScene';
import { QueueScene } from '../scenes/QueueScene';

function yesterdaySummary(u: FloorUnit): string {
  const m = getMachine(u.machineId);
  const flags = counterFlags(m)
    .map((f) => `${f.label} ${u.yesterday.counts[f.key] ?? 0}回(${odds(u.yesterday.counts[f.key] ?? 0, u.yesterday.games)})`)
    .join('  ');
  return `前日 ${num(u.yesterday.games)}G  ${flags}  差枚 ${signedCoins(u.yesterday.coinDiff)}`;
}

/** 島の間の通路に出す前日データの帯。マウスを乗せた台を表示し、台を隠さない */
function CounterStrip({ unit }: { unit: FloorUnit }) {
  const m = getMachine(unit.machineId);
  const cell = (label: string, value: string) => (
    <div className="flex items-baseline gap-2">
      <span className="text-[15px] text-neutral-400">{label}</span>
      <span className="lcd px-2 text-[20px]">{value}</span>
    </div>
  );
  return (
    <div className="game-window absolute top-[214px] left-1/2 z-10 flex h-[72px] w-[1060px] -translate-x-1/2 items-center gap-6 px-5">
      <span className="text-[24px] text-amber-300">#{unit.unitNo}</span>
      <span className="w-[200px] truncate text-[18px]">{m.name}</span>
      {cell('前日', `${num(unit.yesterday.games)}G`)}
      {counterFlags(m)
        .map((f) => (
          <div key={f.key}>{cell(f.label, `${unit.yesterday.counts[f.key] ?? 0} (${odds(unit.yesterday.counts[f.key] ?? 0, unit.yesterday.games)})`)}</div>
        ))}
      {cell('差枚', signedCoins(unit.yesterday.coinDiff))}
      <span className="ml-auto text-[15px] text-neutral-500">{unit.takenBy === 'NONE' ? '空き' : '着席中'}</span>
    </div>
  );
}

export function FloorPhase() {
  const today = useGameStore((s) => s.today);
  const sitDown = useGameStore((s) => s.sitDown);
  const startHyena = useGameStore((s) => s.startHyena);
  const leaveFloor = useGameStore((s) => s.leaveFloor);
  const date = useGameStore((s) => s.player.currentDate);
  const [step, setStep] = useState<'queue' | 'floor'>('queue');
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  if (!today) return null;

  const parlor = getParlor(today.parlorId);
  const seed = `${date}-${today.parlorId}`;

  if (step === 'queue') {
    const ratio = today.lotteryNumber / today.queueSize;
    const comment = ratio <= 0.1 ? '悪くない番号だ。' : ratio <= 0.5 ? 'まあ、こんなものか。' : ratio <= 0.8 ? '後ろの方だ。' : '……今日は厳しい。';
    return (
      <>
        <QueueScene parlorName={parlor.name} queueSize={today.queueSize} eventDay={today.isEventDay} seed={seed} />
        <Hud clock={9 * 60} />
        {/* 抽選券 */}
        <div className="absolute top-[250px] left-[150px] z-10 rotate-[-4deg] border-2 border-neutral-400 bg-[#f1ece0] px-10 py-4 text-center text-black shadow-[6px_6px_0_rgb(0_0_0/0.6)]">
          <div className="text-[16px] tracking-widest">入場抽選券</div>
          <div className="text-[72px] leading-none tabular-nums">{String(today.lotteryNumber).padStart(3, '0')}</div>
          <div className="text-[15px]">/ {today.queueSize}名</div>
        </div>
        <MessageWindow
          speaker={parlor.name}
          text={`抽選番号は ${today.lotteryNumber}番。${today.queueSize}人中。${comment}${today.isEventDay ? '\n今日は「強い日」だ。並びの空気が違う。' : ''}`}
          choices={[{ label: '入場する', onSelect: () => setStep('floor') }]}
        />
      </>
    );
  }

  const free = today.floor.filter((u) => u.takenBy === 'NONE');
  const selectedUnit = today.floor.find((u) => u.unitNo === selected);
  const panelUnit = today.floor.find((u) => u.unitNo === (hovered ?? selected));

  return (
    <>
      <FloorScene
        floor={today.floor}
        seed={seed}
        highlighted={hovered ?? selected}
        interactive
        onHover={setHovered}
        onSelect={setSelected}
      />
      <Hud clock={OPEN_TIME + Math.floor(today.lotteryNumber / 30)} />
      {panelUnit && <CounterStrip unit={panelUnit} />}
      {selectedUnit ? (
        <MessageWindow
          text={`#${selectedUnit.unitNo} ${getMachine(selectedUnit.machineId).name}\n${yesterdaySummary(selectedUnit)}`}
          choices={[
            { label: 'この台に座る', onSelect: () => sitDown(selectedUnit.unitNo) },
            { label: '他の台を見る', onSelect: () => setSelected(null) },
          ]}
        />
      ) : (
        <MessageWindow
          text={
            free.length > 0
              ? `空き台は ${free.length} / ${today.floor.length}。\nデータカウンターを見て回る。（台をクリックで選択）`
              : '空き台はない。島は埋まっている。'
          }
          choices={[
            { label: 'ハイエナで島を巡回する', sub: '店マーク↑', onSelect: startHyena },
            { label: '帰る', sub: '精神-4', onSelect: leaveFloor },
          ]}
        />
      )}
    </>
  );
}
