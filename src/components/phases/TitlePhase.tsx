import { useState } from 'react';
import { LEGACY_PERKS } from '../../data/legacy';
import { drawTraitChoices } from '../../data/traits';
import { useGameStore } from '../../stores/useGameStore';
import { availablePoints, useRunStore } from '../../stores/useRunStore';
import { useUiStore } from '../../stores/useUiStore';
import { MessageWindow, type Choice } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { TitleScene } from '../scenes/TitleScene';

type Step = 'menu' | 'legacy' | 'trait';

export function TitlePhase() {
  const startRun = useGameStore((s) => s.startRun);
  const runs = useRunStore((s) => s.runs);
  const perks = useRunStore((s) => s.perks);
  const points = useRunStore(availablePoints);
  const unlock = useRunStore((s) => s.unlock);
  const openPc = useUiStore((s) => s.openPc);
  const [step, setStep] = useState<Step>('menu');
  const [traits, setTraits] = useState<ReturnType<typeof drawTraitChoices>>([]);

  const menu: Choice[] = [
    { label: '新しい人生を始める', onSelect: () => (setTraits(drawTraitChoices()), setStep('trait')) },
    { label: '前世の記憶', sub: `記憶 ${points}`, disabled: runs.length === 0, onSelect: () => setStep('legacy') },
    { label: 'これまでの人生（墓標）', sub: `${runs.length}件`, disabled: runs.length === 0, onSelect: () => openPc('GRAVES') },
  ];

  let message;
  if (step === 'trait') {
    message = (
      <MessageWindow
        speaker="2008年4月"
        text="会社を辞めた。……いや、そもそも自分は何者だったのか。"
        choices={traits.map((t) => ({ label: t.name, sub: t.description, onSelect: () => startRun(t.id) }))}
      />
    );
  } else if (step === 'legacy') {
    message = (
      <>
        <div className="game-window absolute top-[40px] left-8 z-10 w-[700px] px-6 py-4">
          <div className="mb-2 text-[20px] text-amber-200">前世の記憶</div>
          <ul className="space-y-1.5">
            {LEGACY_PERKS.map((p) => (
              <li key={p.id} className="flex gap-3 text-[17px]">
                <span className={perks.includes(p.id) ? 'w-[8em] shrink-0 text-amber-300' : 'w-[8em] shrink-0 text-neutral-100'}>
                  {perks.includes(p.id) ? '✓ ' : ''}
                  {p.name}
                </span>
                <span className="text-neutral-400">{p.description}</span>
              </li>
            ))}
          </ul>
        </div>
        <MessageWindow
          speaker={`記憶 残り ${points}`}
          text="前の人生で覚えたことが、ぼんやりと残っている。何を持っていく？"
          choices={[
            ...LEGACY_PERKS.map((p) => {
              const owned = perks.includes(p.id);
              return {
                label: p.name,
                sub: owned ? '取得済み' : `記憶${p.cost}`,
                disabled: owned || points < p.cost,
                onSelect: () => unlock(p.id),
              };
            }),
            { label: '戻る', onSelect: () => setStep('menu') },
          ]}
        />
      </>
    );
  } else {
    message = (
      <MessageWindow
        text={
          runs.length === 0
            ? '期待値を積み続ければ、いつか報われる。そう信じていた。'
            : `これまでに ${runs.length} 回の人生を生きた。最後の人生は ${runs[runs.length - 1].endDate.slice(0, 4)} 年に終わった。`
        }
        choices={menu}
      />
    );
  }

  return (
    <>
      <TitleScene />
      <div className="absolute inset-x-0 top-[110px] text-center" hidden={step === 'legacy'}>
        <div className="text-[22px] tracking-[0.4em] text-neutral-400">Loneliness of a Slot Pro: 2008-2026</div>
        <h1 className="mt-3 text-[64px] tracking-widest text-neutral-100" style={{ textShadow: '0 0 18px rgb(255 61 139 / 0.5)' }}>
          孤独なパチスロ専業の一生
        </h1>
      </div>
      {message}
      <PcWindow tabs={['GRAVES']} />
    </>
  );
}
