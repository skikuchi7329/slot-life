import { NIGHT_ACTION_LIST, useGameStore } from '../../stores/useGameStore';
import { useUiStore } from '../../stores/useUiStore';
import type { DayLog } from '../../types';
import { num, signedYen } from '../../utils/format';
import { Hud } from '../game/Hud';
import { MessageWindow } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { RoomScene } from '../scenes/RoomScene';

function summary(log: DayLog): string {
  if (log.actionType === 'REST') return log.memo;
  const z = log.sigma > 0 ? (log.actualProfit - log.expectedValue) / log.sigma : 0;
  const flavor =
    z < -1.5
      ? '期待値は積んだ。そう書き込む指が少し震えた。'
      : z < 0
        ? '期待値には届かなかった。いつものことだ。'
        : log.actualProfit > 0
          ? '勝った。だが、それは分散がこちらに転んだだけだ。'
          : '負けたが、期待値以上ではあった。数字だけが慰めになる。';
  return [
    `推定期待値 ${signedYen(log.expectedValue)}円 ／ 実収支 ${signedYen(log.actualProfit)}円`,
    `乖離 ${z >= 0 ? '+' : ''}${z.toFixed(2)}σ（σ=${num(log.sigma)}円）${log.estimatedSetting !== null ? ` 推定設定${log.estimatedSetting.toFixed(1)}` : ''}`,
    flavor,
  ].join('\n');
}

/** 23:30 自室。収支を記帳して、夜の過ごし方を選ぶ */
export function NightPhase() {
  const player = useGameStore((s) => s.player);
  const log = useGameStore((s) => s.lastLog);
  const nightAction = useGameStore((s) => s.nightAction);
  const openPc = useUiStore((s) => s.openPc);
  if (!log) return null;

  return (
    <>
      <RoomScene time="night" pcOn seed={player.currentDate} mental={player.mental} />
      <Hud clock={23 * 60 + 30} />
      <MessageWindow
        speaker="収支表.xls"
        text={summary(log)}
        choices={[
          ...NIGHT_ACTION_LIST.map((a) => ({
            label: a.label,
            sub: `${a.cost > 0 ? `${a.cost}円 ` : ''}体${a.health >= 0 ? '+' : ''}${a.health} 精${a.mental >= 0 ? '+' : ''}${a.mental}`,
            disabled: a.cost > player.cash,
            onSelect: () => nightAction(a.id),
          })),
          { label: '収支表を見返す', onSelect: () => openPc('LEDGER') },
        ]}
      />
      <PcWindow tabs={['LEDGER', 'CHART']} />
    </>
  );
}
