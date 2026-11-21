import { getEnvironment } from '../../data/eras';
import { getEvent, resolveChoices, resolveText } from '../../data/events';
import { PARLORS } from '../../data/parlors';
import { isEventDay } from '../../engine/floor';
import { eventContext, useGameStore } from '../../stores/useGameStore';
import { useUiStore } from '../../stores/useUiStore';
import { Hud } from '../game/Hud';
import { MessageWindow } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { RoomScene } from '../scenes/RoomScene';

/** 07:00 自室。ニュース → 突発イベント → 今日の行き先、の順に選択肢を出す */
export function MorningPhase() {
  const player = useGameStore((s) => s.player);
  const notices = useGameStore((s) => s.notices);
  const news = useGameStore((s) => s.pendingNews[0]);
  const eventId = useGameStore((s) => s.pendingEventId);
  const dismissNews = useGameStore((s) => s.dismissNews);
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const goToParlor = useGameStore((s) => s.goToParlor);
  const restDay = useGameStore((s) => s.restDay);
  const openPc = useUiStore((s) => s.openPc);

  const env = getEnvironment(player.currentDate);
  const event = eventId ? getEvent(eventId) : undefined;

  let message;
  if (news) {
    message = <MessageWindow speaker="テレビ" text={`【${news.headline}】\n${news.body}`} choices={[{ label: '……', onSelect: dismissNews }]} />;
  } else if (event) {
    const ctx = eventContext(player);
    message = (
      <MessageWindow
        speaker={event.speaker}
        text={resolveText(event, ctx)}
        choices={resolveChoices(event, ctx).map((c, i) => ({ label: c.label, onSelect: () => resolveEvent(i) }))}
      />
    );
  } else {
    message = (
      <MessageWindow
        text={[...notices, '今日はどこへ行く？'].join('\n')}
        choices={[
          ...PARLORS.map((p) => {
            const eventDay = isEventDay(p, player.currentDate);
            return {
              label: p.name,
              sub: `${eventDay ? (env.eventsAllowed ? '★イベント日 ' : '★旧イベ日 ') : ''}並び約${p.baseQueue}人`,
              onSelect: () => goToParlor(p.id),
            };
          }),
          { label: '今日は休む', sub: '体力+8 精神-2', onSelect: restDay },
          { label: 'パソコンで収支表を見る', onSelect: () => openPc('LEDGER') },
        ]}
      />
    );
  }

  return (
    <>
      <RoomScene time="morning" pcOn={false} seed={player.currentDate} mental={player.mental} />
      <Hud clock={7 * 60} />
      {message}
      <PcWindow tabs={['LEDGER', 'CHART']} />
    </>
  );
}
