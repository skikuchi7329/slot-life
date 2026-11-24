import { useState } from 'react';
import { borrowLimit, TOTAL_VOLUME_REGULATION, useGameStore } from '../../stores/useGameStore';
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
  const deposit = useGameStore((s) => s.deposit);
  const withdraw = useGameStore((s) => s.withdraw);
  const borrow = useGameStore((s) => s.borrow);
  const repay = useGameStore((s) => s.repay);
  const openPc = useUiStore((s) => s.openPc);
  const [money, setMoney] = useState(false);
  if (!week) return null;
  const limit = borrowLimit(player);

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
          <span className="text-neutral-400">所持金 ／ 貯金</span>
          <span className="text-right">
            {num(player.cash)} ／ {num(player.bankSavings)}円
          </span>
          {player.debt > 0 && (
            <>
              <span className="text-neutral-400">借金</span>
              <span className="text-right text-red-400">{num(player.debt)}円</span>
            </>
          )}
        </div>
        {lines.length > 0 && (
          <ul className="mt-3 max-h-[120px] space-y-0.5 overflow-hidden border-t border-neutral-700 pt-2 text-[15px] text-neutral-300">
            {lines.slice(0, 5).map((l, i) => (
              <li key={i}>・{l}</li>
            ))}
          </ul>
        )}
      </div>

      {money ? (
        <MessageWindow
          speaker="お金の管理"
          text={`現金は打つための資金、貯金は生活を守るための金。\n現金が尽きると、貯金に手をつけることになる。`}
          choices={[
            { label: '10万円を貯金する', disabled: player.cash < 100_000, onSelect: () => deposit(100_000) },
            { label: '30万円を貯金する', disabled: player.cash < 300_000, onSelect: () => deposit(300_000) },
            { label: '貯金を10万円下ろす', sub: '精-2', disabled: player.bankSavings <= 0, onSelect: () => withdraw(100_000) },
            {
              label: '消費者金融で30万円借りる',
              sub: limit > 0 ? `年利18% 枠${num(limit)}円` : player.currentDate >= TOTAL_VOLUME_REGULATION ? '総量規制で審査に通らない' : '枠がない',
              disabled: limit <= 0,
              onSelect: () => borrow(300_000),
            },
            { label: '借金を10万円返す', disabled: player.debt <= 0 || player.cash <= 0, onSelect: () => repay(100_000) },
            { label: '戻る', onSelect: () => setMoney(false) },
          ]}
        />
      ) : (
      <MessageWindow
        text={
          week.highlights.length > 0
            ? '今週もデータカウンターの数字を追い続けた。\n思い出せるのは、いくつかの数字と、あの瞬間だけだ。'
            : '今週もデータカウンターの数字を追い続けた。\n何日だったか、もうよく思い出せない。'
        }
        choices={[
          { label: '眠る', sub: '翌週へ', onSelect: () => nextWeek(false) },
          { label: '求人サイトを眺めてから眠る', sub: '精-7 社会信用+1', onSelect: () => nextWeek(true) },
          { label: 'お金の管理', sub: '貯金・借入', onSelect: () => setMoney(true) },
          { label: '収支表・店のデータを見る', sub: 'PC', onSelect: () => openPc('SHOP_DATA') },
        ]}
      />
      )}
      <PcWindow tabs={['LEDGER', 'CHART', 'SHOP_DATA', 'SHOP_STATS']} />
    </>
  );
}
