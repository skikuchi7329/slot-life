import { getEnvironment } from '../../data/eras';
import { getTrait } from '../../data/traits';
import { useGameStore } from '../../stores/useGameStore';
import { cn } from '../../utils/cn';
import { clockLabel, dateLabel, num } from '../../utils/format';

/** 10マスのゲージ */
function Meter({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const filled = Math.round(value / 10);
  const danger = invert ? value >= 60 : value < 30;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[4.5em] text-right text-[15px] text-neutral-400">{label}</span>
      <div className="flex gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn('h-[14px] w-[9px]', i < filled ? (danger ? 'bg-red-500' : invert ? 'bg-amber-400' : 'bg-neutral-200') : 'bg-neutral-800')}
          />
        ))}
      </div>
    </div>
  );
}

export function Hud({ clock }: { clock: number }) {
  const player = useGameStore((s) => s.player);
  const traitId = useGameStore((s) => s.traitId);
  const env = getEnvironment(player.currentDate);

  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-[60px] items-center gap-8 border-b-2 border-black bg-black/80 px-6">
      <div className="leading-tight">
        <div className="text-[26px] tabular-nums">
          {dateLabel(player.currentDate)} <span className="text-neutral-400">{clockLabel(clock)}</span>
        </div>
        <div className="text-[14px] text-neutral-400">
          {env.era.name}・{env.exchangeRate >= 20 ? '等価' : `${(100 / env.exchangeRate).toFixed(1)}枚交換`}・
          {env.eventsAllowed ? 'イベント可' : 'イベント禁止'}
          {traitId && <span className="ml-2 text-neutral-500">［{getTrait(traitId).name}］</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <Meter label="体力" value={player.health} />
        <Meter label="精神" value={player.mental} />
        <Meter label="店マーク" value={player.hallMark} invert />
        <Meter label="社会信用" value={player.socialCredit} />
      </div>

      <div className="ml-auto text-right leading-tight">
        <div className="text-[14px] text-neutral-400">所持金</div>
        <div className={cn('text-[30px] tabular-nums', player.cash < 100_000 ? 'text-red-400' : 'text-neutral-100')}>
          {num(player.cash)}
          <span className="ml-1 text-[18px]">円</span>
        </div>
      </div>
    </div>
  );
}
