import { useState } from 'react';
import { getEnvironment } from '../../data/eras';
import { getEvent, resolveChoices, resolveText } from '../../data/events';
import { PARLORS } from '../../data/parlors';
import { isEventDay } from '../../engine/floor';
import { eventContext, LIFESTYLE_LIST, lifestyleCost, useGameStore, weekDates } from '../../stores/useGameStore';
import { hasPerk } from '../../stores/useRunStore';
import { useUiStore } from '../../stores/useUiStore';
import type { Lifestyle, Parlor, WeekPlan, WorkStyle } from '../../types';
import { dateLabel } from '../../utils/format';
import { Hud } from '../game/Hud';
import { MessageWindow, type Choice } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { RoomScene } from '../scenes/RoomScene';

type Step = 'menu' | 'lifestyle' | 'parlor' | 'style' | 'days' | 'shoubu';

interface Draft {
  lifestyle?: Lifestyle;
  parlorId?: string;
  style?: WorkStyle;
  workDays?: 5 | 6 | 7;
}

/** 前世の記憶「店の癖」があるときだけ見える、店の本当の性格 */
function parlorHabit(p: Parlor): string {
  const total = (w: number[]) => w.reduce((a, b) => a + b, 0);
  const high = (w: number[]) => Math.round(((w[3] + w[4] + w[5]) / total(w)) * 100);
  return `据え置き${Math.round(p.carryOverRate * 100)}%・高設定 平日${high(p.normalWeights)}%/狙い日${high(p.eventWeights)}%`;
}

const short = (iso: string) => dateLabel(iso).slice(5);

/** 週の初め（07:00 自室）。ニュース → 突発イベント → 今週の方針、の順に選ぶ */
export function WeekPlanPhase() {
  const player = useGameStore((s) => s.player);
  const weekStart = useGameStore((s) => s.weekStart);
  const lastPlan = useGameStore((s) => s.lastPlan);
  const notices = useGameStore((s) => s.notices);
  const news = useGameStore((s) => s.pendingNews[0]);
  const eventId = useGameStore((s) => s.pendingEventId);
  const dismissNews = useGameStore((s) => s.dismissNews);
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const planWeek = useGameStore((s) => s.planWeek);
  const openPc = useUiStore((s) => s.openPc);
  const [step, setStep] = useState<Step>(lastPlan ? 'menu' : 'lifestyle');
  const [draft, setDraft] = useState<Draft>({});

  const env = getEnvironment(player.currentDate);
  const dates = weekDates(weekStart);
  const range = `${short(dates[0])}〜${short(dates[6])}`;
  const event = eventId ? getEvent(eventId) : undefined;
  const habit = hasPerk('PARLOR_HABIT');

  const commit = (shoubu: WeekPlan['shoubu']) =>
    planWeek({
      lifestyle: draft.lifestyle!,
      parlorId: draft.parlorId!,
      style: draft.style!,
      workDays: draft.workDays!,
      shoubu,
    });

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
  } else if (step === 'menu' && lastPlan) {
    message = (
      <MessageWindow
        text={[...notices, `今週（${range}）はどうする？`].join('\n')}
        choices={[
          {
            label: '先週と同じ方針で',
            sub: `${PARLORS.find((p) => p.id === lastPlan.parlorId)?.name.slice(0, 8)}・週${lastPlan.workDays}`,
            onSelect: () => {
              setDraft(lastPlan);
              setStep('shoubu');
            },
          },
          { label: '方針を決め直す', onSelect: () => setStep('lifestyle') },
          { label: 'パソコンで収支表を見る', onSelect: () => openPc('LEDGER') },
        ]}
      />
    );
  } else if (step === 'lifestyle') {
    message = (
      <MessageWindow
        text={[...(lastPlan ? [] : notices), `今週（${range}）の暮らし方は？`].join('\n')}
        choices={LIFESTYLE_LIST.map((l) => ({
          label: l.label,
          sub: `${lifestyleCost(l.id, player.currentDate)}円/日 体+${l.health} 精+${l.mental}`,
          onSelect: () => {
            setDraft((d) => ({ ...d, lifestyle: l.id }));
            setStep('parlor');
          },
        }))}
      />
    );
  } else if (step === 'parlor') {
    message = (
      <MessageWindow
        text="おまかせで通う店は？"
        choices={PARLORS.map((p) => ({
          label: p.name,
          sub: habit ? parlorHabit(p) : `並び約${p.baseQueue}人`,
          onSelect: () => {
            setDraft((d) => ({ ...d, parlorId: p.id }));
            setStep('style');
          },
        }))}
      />
    );
  } else if (step === 'style') {
    message = (
      <MessageWindow
        text="打ち方は？"
        choices={[
          { label: '設定狙い', sub: 'データで座り、判別して見切る', onSelect: () => (setDraft((d) => ({ ...d, style: 'SETTING' })), setStep('days')) },
          { label: 'ハイエナ中心', sub: `店マーク↑ 時給目安${Math.round(env.hyenaCoinsPerHour * env.exchangeRate)}円`, onSelect: () => (setDraft((d) => ({ ...d, style: 'HYENA' })), setStep('days')) },
        ]}
      />
    );
  } else if (step === 'days') {
    const days: (5 | 6 | 7)[] = [5, 6, 7];
    message = (
      <MessageWindow
        text="週に何日、打つ？"
        choices={days.map((n) => ({
          label: `週${n}日`,
          sub: n === 7 ? '休みなし' : `${7 - n}日休む`,
          onSelect: () => (setDraft((d) => ({ ...d, workDays: n })), setStep('shoubu')),
        }))}
      />
    );
  } else {
    // 勝負日の候補：今週の各店の狙い日を先に、なければ通う店の最終日
    const options: Choice[] = [];
    for (const d of dates) {
      for (const p of PARLORS) {
        if (isEventDay(p, d) && options.length < 5) {
          options.push({
            label: `${short(d)} ${p.name}`,
            sub: env.eventsAllowed ? '★イベント日' : '★旧イベ日',
            onSelect: () => commit({ date: d, parlorId: p.id }),
          });
        }
      }
    }
    const regular = PARLORS.find((p) => p.id === draft.parlorId);
    if (regular) {
      options.push({ label: `${short(dates[6])} ${regular.name}`, sub: '週末にいつもの店で', onSelect: () => commit({ date: dates[6], parlorId: regular.id }) });
    }
    options.push({ label: '勝負日は作らない', sub: '全日おまかせ', onSelect: () => commit(null) });
    message = <MessageWindow text={`勝負日は？（自分の目で台を選び、判断する日）`} choices={options} />;
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
