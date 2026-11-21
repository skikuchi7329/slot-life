import { useGameStore } from '../../stores/useGameStore';
import { useLogStore } from '../../stores/useLogStore';
import { useUiStore } from '../../stores/useUiStore';
import { signedYen } from '../../utils/format';
import { MessageWindow } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { RoomScene } from '../scenes/RoomScene';

/** 人生の終わり。ここで初めて「真の期待値」が明かされる */
export function GameOverPhase() {
  const player = useGameStore((s) => s.player);
  const reason = useGameStore((s) => s.gameOverReason);
  const backToTitle = useGameStore((s) => s.backToTitle);
  const logs = useLogStore((s) => s.logs);
  const openPc = useUiStore((s) => s.openPc);

  const ev = logs.reduce((a, l) => a + l.expectedValue, 0);
  const trueEv = logs.reduce((a, l) => a + l.trueExpectedValue, 0);
  const actual = logs.reduce((a, l) => a + l.actualProfit, 0);

  return (
    <>
      <RoomScene time="night" pcOn={false} seed={player.currentDate} mental={0} />
      <div className="absolute inset-0 bg-black/85" />
      <div className="absolute inset-x-0 top-[120px] text-center">
        <div className="text-[20px] tracking-[0.5em] text-neutral-500">{player.currentDate.replaceAll('-', '.')}</div>
        <div className="mt-6 grid grid-cols-3 gap-6 px-40 text-[20px] tabular-nums">
          <div>
            <div className="text-[15px] text-neutral-500">記帳していた期待値</div>
            <div className="text-ev">{signedYen(ev)}円</div>
          </div>
          <div>
            <div className="text-[15px] text-neutral-500">本当の期待値</div>
            <div className={trueEv < ev ? 'text-red-400' : 'text-neutral-100'}>{signedYen(trueEv)}円</div>
          </div>
          <div>
            <div className="text-[15px] text-neutral-500">実収支</div>
            <div className="text-actual">{signedYen(actual)}円</div>
          </div>
        </div>
      </div>
      <MessageWindow
        speaker="――"
        text={reason ?? ''}
        choices={[
          { label: '答え合わせを見る', onSelect: () => openPc('ANSWER') },
          { label: '墓標に刻んで、次の人生へ', onSelect: backToTitle },
        ]}
      />
      <PcWindow tabs={['LEDGER', 'CHART', 'ANSWER']} />
    </>
  );
}
