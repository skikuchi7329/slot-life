import { useGameStore } from '../../stores/useGameStore';
import { useUiStore } from '../../stores/useUiStore';
import { cn } from '../../utils/cn';
import { dateLabel, num, signedYen } from '../../utils/format';
import { Hud } from '../game/Hud';
import { MessageWindow } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { RoomScene } from '../scenes/RoomScene';

/** 週の締め（日曜 23:30 自室）。週報を眺めて眠る */
export function WeekEndPhase() {
  const player = useGameStore((s) => s.player);
  const week = useGameStore((s) => s.week);
  const nextWeek = useGameStore((s) => s.nextWeek);
  const openPc = useUiStore((s) => s.openPc);
  if (!week) return null;

  const diff = week.actualProfit - week.expectedValue;
  const lines = [...week.highlights, ...week.notices];

  return (
    <>
      <RoomScene time="night" pcOn seed={player.currentDate} mental={player.mental} />
      <Hud clock={23 * 60 + 30} date={week.end} />

      <div className="game-window absolute top-[84px] left-8 z-10 w-[560px] px-6 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[22px] text-amber-200">週報</span>
          <span className="text-[16px] text-neutral-400">
            {dateLabel(week.start).slice(5)} 〜 {dateLabel(week.end).slice(5)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[19px] tabular-nums">
          <span className="text-neutral-400">稼働</span>
          <span className="text-right">{week.workDays}日</span>
          <span className="text-neutral-400">推定期待値</span>
          <span className="text-right text-ev">{signedYen(week.expectedValue)}円</span>
          <span className="text-neutral-400">実収支</span>
          <span className={cn('text-right', week.actualProfit < 0 ? 'text-red-400' : 'text-actual')}>{signedYen(week.actualProfit)}円</span>
          <span className="text-neutral-400">乖離</span>
          <span className={cn('text-right', diff < 0 ? 'text-red-400' : 'text-neutral-200')}>{signedYen(diff)}円</span>
          <span className="text-neutral-400">所持金</span>
          <span className="text-right">{num(player.cash)}円</span>
        </div>
        {lines.length > 0 && (
          <ul className="mt-3 max-h-[120px] space-y-0.5 overflow-hidden border-t border-neutral-700 pt-2 text-[15px] text-neutral-300">
            {lines.slice(0, 5).map((l, i) => (
              <li key={i}>・{l}</li>
            ))}
          </ul>
        )}
      </div>

      <MessageWindow
        text={
          week.highlights.length > 0
            ? '今週もデータカウンターの数字を追い続けた。\n思い出せるのは、いくつかの数字と、あの瞬間だけだ。'
            : '今週もデータカウンターの数字を追い続けた。\n何日だったか、もうよく思い出せない。'
        }
        choices={[
          { label: '眠る', sub: '翌週へ', onSelect: () => nextWeek(false) },
          { label: '求人サイトを眺めてから眠る', sub: '精-7 社会信用+1', onSelect: () => nextWeek(true) },
          { label: '収支表を見返す', onSelect: () => openPc('LEDGER') },
        ]}
      />
      <PcWindow tabs={['LEDGER', 'CHART']} />
    </>
  );
}
