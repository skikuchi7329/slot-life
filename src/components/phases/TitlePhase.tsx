import { useState } from 'react';
import { drawTraitChoices } from '../../data/traits';
import { useGameStore } from '../../stores/useGameStore';
import { useRunStore } from '../../stores/useRunStore';
import { useUiStore } from '../../stores/useUiStore';
import { MessageWindow, type Choice } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { TitleScene } from '../scenes/TitleScene';

export function TitlePhase() {
  const startRun = useGameStore((s) => s.startRun);
  const runs = useRunStore((s) => s.runs);
  const openPc = useUiStore((s) => s.openPc);
  const [traits, setTraits] = useState<ReturnType<typeof drawTraitChoices> | null>(null);

  const menu: Choice[] = [
    { label: '新しい人生を始める', onSelect: () => setTraits(drawTraitChoices()) },
    { label: 'これまでの人生（墓標）', sub: `${runs.length}件`, disabled: runs.length === 0, onSelect: () => openPc('GRAVES') },
  ];

  return (
    <>
      <TitleScene />
      <div className="absolute inset-x-0 top-[110px] text-center">
        <div className="text-[22px] tracking-[0.4em] text-neutral-400">Loneliness of a Slot Pro: 2008-2026</div>
        <h1 className="mt-3 text-[64px] tracking-widest text-neutral-100" style={{ textShadow: '0 0 18px rgb(255 61 139 / 0.5)' }}>
          孤独なパチスロ専業の一生
        </h1>
      </div>

      {traits ? (
        <MessageWindow
          speaker="2008年4月"
          text="会社を辞めた。……いや、そもそも自分は何者だったのか。"
          choices={traits.map((t) => ({ label: t.name, sub: t.description, onSelect: () => startRun(t.id) }))}
        />
      ) : (
        <MessageWindow
          text={
            runs.length === 0
              ? '期待値を積み続ければ、いつか報われる。そう信じていた。'
              : `これまでに ${runs.length} 回の人生を生きた。最後の人生は ${runs[runs.length - 1].endDate.slice(0, 4)} 年に終わった。`
          }
          choices={menu}
        />
      )}
      <PcWindow tabs={['GRAVES']} />
    </>
  );
}
