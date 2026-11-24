import { useGameStore } from '../../stores/useGameStore';
import { useUiStore } from '../../stores/useUiStore';
import type { DayLog } from '../../types';
import { num, signedYen } from '../../utils/format';
import { Hud } from '../game/Hud';
import { MessageWindow } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { RoomScene } from '../scenes/RoomScene';

function daySummary(log: DayLog): string {
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

/** 勝負日の夜（23:30 自室）。記帳して、週の残りをおまかせで過ごす */
export function ShoubuNightPhase() {
  const player = useGameStore((s) => s.player);
  const log = useGameStore((s) => s.lastLog);
  const finishShoubu = useGameStore((s) => s.finishShoubu);
  const openPc = useUiStore((s) => s.openPc);
  if (!log) return null;

  return (
    <>
      <RoomScene time="night" pcOn seed={player.currentDate} mental={player.mental} />
      <Hud clock={23 * 60 + 30} />
      <MessageWindow
        speaker="収支表.xls"
        text={daySummary(log)}
        choices={[
          { label: '週の残りを過ごす', sub: 'おまかせ稼働', onSelect: finishShoubu },
          { label: '今日の店のデータを見る', sub: 'PC', onSelect: () => openPc('SHOP_DATA') },
          { label: '収支表を見返す', onSelect: () => openPc('LEDGER') },
        ]}
      />
      <PcWindow tabs={['LEDGER', 'CHART', 'SHOP_DATA', 'SHOP_STATS']} />
    </>
  );
}
