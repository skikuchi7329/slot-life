import { useState } from 'react';
import { getMachine } from '../../data/machines';
import { isFree } from '../../engine/floor';
import { OPEN_TIME, useGameStore } from '../../stores/useGameStore';
import { Hud } from '../game/Hud';
import { MessageWindow } from '../game/MessageWindow';
import { NoticeCard } from '../parlor/NoticeCard';
import { UnitStrip } from '../parlor/UnitStrip';
import { FloorScene } from '../scenes/FloorScene';
import { QueueScene } from '../scenes/QueueScene';
import type { Runner, Today } from '../../types';

/** 勝負日：打ち子の台を決める（自分の台を決めたあと、打ち子の番号の順に） */
function RunnerAssign({ today, runner, lottery, seed }: { today: Today; runner: Runner; lottery: number; seed: string }) {
  const assignRunner = useGameStore((s) => s.assignRunner);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const entry = OPEN_TIME + Math.floor(lottery / 30);
  const free = today.floor.filter((u) => isFree(u, entry));
  const selectedUnit = free.find((u) => u.unitNo === selected);
  const panelUnit = today.floor.find((u) => u.unitNo === (hovered ?? selected));
  const mine = today.session?.unitNo;
  const shifts = today.runnerShifts ?? [];
  const statusOf = (unitNo: number) =>
    unitNo === mine ? '自分の台' : shifts.find((x) => x.unitNo === unitNo) ? '打ち子' : isFree(today.floor.find((u) => u.unitNo === unitNo)!, entry) ? '空き' : '着席中';

  return (
    <>
      <FloorScene floor={today.floor} seed={seed} highlighted={hovered ?? selected} interactive onHover={setHovered} onSelect={setSelected} at={entry} />
      <Hud clock={entry} />
      {panelUnit && <UnitStrip unit={panelUnit} status={statusOf(panelUnit.unitNo)} />}
      {selectedUnit ? (
        <MessageWindow
          speaker={`打ち子（${runner.name}）`}
          text={`#${selectedUnit.unitNo} ${getMachine(selectedUnit.machineId).name}${selectedUnit.corner ? '（角台）' : ''}\nこの台を打たせる？`}
          choices={[
            { label: '閉店まで打ち切らせる', onSelect: () => assignRunner(selectedUnit.unitNo, 'CLOSE') },
            { label: '見切ったらハイエナに回す', sub: '判別はおまかせと同じ', onSelect: () => assignRunner(selectedUnit.unitNo, 'HYENA') },
            { label: '見切ったら帰っていい', onSelect: () => assignRunner(selectedUnit.unitNo, 'HOME') },
            { label: '他の台を見る', onSelect: () => setSelected(null) },
          ]}
        />
      ) : (
        <MessageWindow
          speaker={`打ち子（${runner.name}）`}
          text={`${runner.name}の番号は ${lottery}番。入れるのは ${Math.floor(entry / 60)}:${String(entry % 60).padStart(2, '0')}ごろ。\n空き台は ${free.length}台。どの台を打たせる？（台をクリックで選択）`}
          choices={[
            { label: 'いつもの狙い方に任せる', sub: '見切ったらハイエナ', disabled: free.length === 0, onSelect: () => assignRunner('AUTO', 'HYENA') },
            { label: '最初からハイエナで巡回させる', onSelect: () => assignRunner('HYENA') },
            { label: '今日は帰す', sub: '日当は払う', onSelect: () => assignRunner(null) },
          ]}
        />
      )}
    </>
  );
}

export function FloorPhase() {
  const today = useGameStore((s) => s.today);
  const parlors = useGameStore((s) => s.parlors);
  const sitDown = useGameStore((s) => s.sitDown);
  const startHyena = useGameStore((s) => s.startHyena);
  const leaveFloor = useGameStore((s) => s.leaveFloor);
  const runners = useGameStore((s) => s.crew.runners);
  const date = useGameStore((s) => s.player.currentDate);
  const [step, setStep] = useState<'queue' | 'floor'>('queue');
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  if (!today) return null;

  const parlor = parlors.find((p) => p.id === today.parlorId) ?? parlors[0];
  const seed = `${date}-${today.parlorId}`;
  const entry = OPEN_TIME + Math.floor(today.lotteryNumber / 30);

  // 自分の台を決めたあと、打ち子の台を決める
  if (today.session) {
    const k = (today.runnerShifts ?? []).length;
    const runner = runners[k];
    const lottery = today.lotteries?.[1 + k];
    if (!runner || lottery === undefined) return null;
    return <RunnerAssign key={runner.id} today={today} runner={runner} lottery={lottery} seed={seed} />;
  }

  if (step === 'queue') {
    const ratio = today.lotteryNumber / today.queueSize;
    const group = today.lotteries && today.lotteries.length > 1 ? today.lotteries : null;
    const comment = ratio <= 0.1 ? '悪くない番号だ。' : ratio <= 0.5 ? 'まあ、こんなものか。' : ratio <= 0.8 ? '後ろの方だ。' : '……今日は厳しい。';
    return (
      <>
        <QueueScene parlorName={parlor.name} queueSize={today.queueSize} eventDay={today.notice !== null} seed={seed} />
        <Hud clock={9 * 60} />
        {today.notice && <NoticeCard medium={today.notice.medium} text={today.notice.text} />}
        {/* 抽選券 */}
        <div className="absolute top-[250px] left-[150px] z-10 rotate-[-4deg] border-2 border-neutral-400 bg-[#f1ece0] px-10 py-4 text-center text-black shadow-[6px_6px_0_rgb(0_0_0/0.6)]">
          <div className="text-[16px] tracking-widest">入場抽選券</div>
          <div className="text-[72px] leading-none tabular-nums">{String(today.lotteryNumber).padStart(3, '0')}</div>
          <div className="text-[15px]">/ {today.queueSize}名</div>
        </div>
        <MessageWindow
          speaker={parlor.name}
          text={`${group ? `${group.length}人で並んだ。番号は ${group.join('・')}番。いちばん若い番号を自分が使う。\n` : `抽選番号は ${today.lotteryNumber}番。`}${today.queueSize}人中。${comment}${today.notice ? '\n告知のせいか、並びの空気が違う。' : ''}`}
          choices={[{ label: '入場する', onSelect: () => setStep('floor') }]}
        />
      </>
    );
  }

  const free = today.floor.filter((u) => isFree(u, entry));
  const selectedUnit = today.floor.find((u) => u.unitNo === selected);
  const panelUnit = today.floor.find((u) => u.unitNo === (hovered ?? selected));

  return (
    <>
      <FloorScene floor={today.floor} seed={seed} highlighted={hovered ?? selected} interactive onHover={setHovered} onSelect={setSelected} at={entry} />
      <Hud clock={entry} />
      {panelUnit && <UnitStrip unit={panelUnit} status={isFree(panelUnit, entry) ? '空き' : '着席中'} />}
      {selectedUnit ? (
        <MessageWindow
          text={`#${selectedUnit.unitNo} ${getMachine(selectedUnit.machineId).name}${selectedUnit.corner ? '（角台）' : ''}\nこの台で勝負する？`}
          choices={[
            { label: 'この台に座る', onSelect: () => sitDown(selectedUnit.unitNo) },
            { label: '他の台を見る', onSelect: () => setSelected(null) },
          ]}
        />
      ) : (
        <MessageWindow
          text={
            free.length > 0
              ? `空き台は ${free.length} / ${today.floor.length}。${today.notice ? `\n告知は「${today.notice.text}」。` : '\n'}データカウンターを見て回る。（台をクリックで選択）`
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
