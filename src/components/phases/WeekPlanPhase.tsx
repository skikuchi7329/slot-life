import { useState } from 'react';
import { getEnvironment } from '../../data/eras';
import { getEvent, resolveChoices, resolveText } from '../../data/events';
import { describeHabit } from '../../data/parlors';
import { noticeFor } from '../../engine/floor';
import { eventContext, gearOf, LIFESTYLE_LIST, lifestyleCost, useGameStore, weekDates } from '../../stores/useGameStore';
import { hasPerk } from '../../stores/useRunStore';
import { useUiStore } from '../../stores/useUiStore';
import type { Lifestyle, ParlorNotice, PickRule, WeekPlan, WorkStyle } from '../../types';
import { dateLabel } from '../../utils/format';
import { Hud } from '../game/Hud';
import { MessageWindow, type Choice } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { RoomScene } from '../scenes/RoomScene';

type Step = 'menu' | 'lifestyle' | 'parlor' | 'style' | 'pick' | 'days' | 'shoubu';

interface Draft {
  lifestyle?: Lifestyle;
  parlorId?: string;
  style?: WorkStyle;
  pickRule?: PickRule;
  workDays?: 5 | 6 | 7;
}

const PICK_RULES: { id: PickRule; label: string; sub: string }[] = [
  { id: 'NOTICE', label: '告知どおりに座る', sub: '告知に合う台、なければ前日好調台' },
  { id: 'CARRY', label: '前日好調台（据え置き狙い）', sub: '前日のボーナス合算が良い台' },
  { id: 'DENTED', label: '前日凹み台（凹み上げ狙い）', sub: '前日いちばん凹んだ台' },
  { id: 'CORNER', label: '角台', sub: '島の端の台' },
  { id: 'TAIL', label: '末尾＝日付', sub: '7日なら末尾7の台' },
];

const short = (iso: string) => dateLabel(iso).slice(5);

/** 週の初め（07:00 自室）。ニュース → 突発イベント → 今週の方針、の順に選ぶ */
export function WeekPlanPhase() {
  const player = useGameStore((s) => s.player);
  const parlors = useGameStore((s) => s.parlors);
  const weekStart = useGameStore((s) => s.weekStart);
  const lastPlan = useGameStore((s) => s.lastPlan);
  const notices = useGameStore((s) => s.notices);
  const flags = useGameStore((s) => s.flags);
  const flagDates = useGameStore((s) => s.flagDates);
  const inventory = useGameStore((s) => s.inventory);
  const crew = useGameStore((s) => s.crew);
  const news = useGameStore((s) => s.pendingNews[0]);
  const eventId = useGameStore((s) => s.pendingEventId);
  const dismissNews = useGameStore((s) => s.dismissNews);
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const planWeek = useGameStore((s) => s.planWeek);
  const openPc = useUiStore((s) => s.openPc);
  const [step, setStep] = useState<Step>(lastPlan && parlors.some((p) => p.id === lastPlan.parlorId) ? 'menu' : 'lifestyle');
  const [draft, setDraft] = useState<Draft>({});

  const env = getEnvironment(player.currentDate);
  const dates = weekDates(weekStart);
  const range = `${short(dates[0])}〜${short(dates[6])}`;
  const event = eventId ? getEvent(eventId) : undefined;
  const habit = hasPerk('PARLOR_HABIT');
  const go = (d: Draft, next: Step) => {
    setDraft((prev) => ({ ...prev, ...d }));
    setStep(next);
  };

  // 今週の告知・匂わせ（店からの示唆）
  const weekNotices: { date: string; parlorId: string; name: string; notice: ParlorNotice }[] = dates.flatMap((d) =>
    parlors.flatMap((p) => {
      const n = noticeFor(p, getEnvironment(d), d);
      return n ? [{ date: d, parlorId: p.id, name: p.name, notice: n }] : [];
    }),
  );

  const commit = (shoubu: WeekPlan['shoubu']) =>
    planWeek({
      lifestyle: draft.lifestyle!,
      parlorId: draft.parlorId!,
      style: draft.style!,
      pickRule: draft.pickRule ?? 'NOTICE',
      workDays: draft.workDays!,
      shoubu,
    });

  const pcChoice: Choice = { label: '店のデータを見る', sub: 'PC', onSelect: () => openPc('SHOP_DATA') };

  let message;
  if (news) {
    message = <MessageWindow speaker="テレビ" text={`【${news.headline}】\n${news.body}`} choices={[{ label: '……', onSelect: dismissNews }]} />;
  } else if (event) {
    const ctx = eventContext(player, flags, flagDates);
    message = (
      <MessageWindow
        speaker={event.speaker}
        text={resolveText(event, ctx)}
        choices={resolveChoices(event, ctx).map((c, i) => ({ label: c.label, onSelect: () => resolveEvent(i) }))}
      />
    );
  } else if (step === 'menu' && lastPlan) {
    const home = parlors.find((p) => p.id === lastPlan.parlorId);
    message = (
      <MessageWindow
        text={[...notices, `今週（${range}）はどうする？`].join('\n')}
        choices={[
          { label: '先週と同じ方針で', sub: `${home?.name.slice(0, 9)}・週${lastPlan.workDays}`, onSelect: () => go(lastPlan, 'shoubu') },
          { label: '方針を決め直す', onSelect: () => setStep('lifestyle') },
          pcChoice,
          { label: '収支表を見る', sub: 'PC', onSelect: () => openPc('LEDGER') },
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
          onSelect: () => go({ lifestyle: l.id }, 'parlor'),
        }))}
      />
    );
  } else if (step === 'parlor') {
    message = (
      <MessageWindow
        text="おまかせで通う、いつもの店は？（告知の出た日は、その店へ行く）"
        choices={[
          ...parlors.map((p) => ({
            label: p.name,
            sub: habit
              ? describeHabit(p)
              : inventory.knownHabits[p.id]
                ? `note：${inventory.knownHabits[p.id]}`
                : `${{ BIG: '大型', MID: '中型', SMALL: '小型' }[p.size]}・並び約${p.baseQueue}人`,
            onSelect: () => go({ parlorId: p.id }, 'style'),
          })),
          pcChoice,
        ]}
      />
    );
  } else if (step === 'style') {
    message = (
      <MessageWindow
        text="打ち方は？"
        choices={[
          { label: '毎日、設定狙い', sub: 'いつもの店で台を選び、判別して見切る', onSelect: () => go({ style: 'SETTING' }, 'pick') },
          { label: '狙い日だけ設定狙い', sub: '告知のない日はハイエナ', onSelect: () => go({ style: 'TARGET' }, 'pick') },
          {
            label: 'ハイエナ中心',
            sub: `店マーク↑ 時給目安${Math.round(env.hyenaCoinsPerHour * gearOf(inventory, player.currentDate).hyenaBoost * env.exchangeRate)}円`,
            onSelect: () => go({ style: 'HYENA', pickRule: 'NOTICE' }, 'days'),
          },
        ]}
      />
    );
  } else if (step === 'pick') {
    message = (
      <MessageWindow
        text={'いつもの店では、どう台を選ぶ？\n（店の癖に合わせると勝ちやすい。店のデータで癖を探そう）'}
        choices={[...PICK_RULES.map((r) => ({ label: r.label, sub: r.sub, onSelect: () => go({ pickRule: r.id }, 'days') })), pcChoice]}
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
          onSelect: () => go({ workDays: n }, 'shoubu'),
        }))}
      />
    );
  } else {
    const regular = parlors.find((p) => p.id === draft.parlorId);
    const options: Choice[] = weekNotices.slice(0, 5).map((w) => ({
      label: `${short(w.date)} ${w.name}`,
      sub: `★${w.notice.medium}`,
      onSelect: () => commit({ date: w.date, parlorId: w.parlorId }),
    }));
    if (regular) options.push({ label: `${short(dates[6])} ${regular.name}`, sub: '週末にいつもの店で', onSelect: () => commit({ date: dates[6], parlorId: regular.id }) });
    options.push({ label: '勝負日は作らない', sub: '全日おまかせ', onSelect: () => commit(null) });
    const crewNote = crew.pullers + crew.runners.length > 0 ? `\n引き子${crew.pullers}人・打ち子${crew.runners.length}人を連れていく。` : '';
    message = <MessageWindow text={`勝負日は？（自分の目で台を選び、判断する日）${crewNote}`} choices={options} />;
  }

  const showNotices = !news && !event && (step === 'menu' || step === 'shoubu');

  return (
    <>
      <RoomScene time="morning" pcOn={false} seed={player.currentDate} mental={player.mental} />
      <Hud clock={7 * 60} />
      {showNotices && (
        <div className="game-window absolute top-[76px] left-6 z-10 w-[590px] px-5 py-3">
          <div className="mb-1 flex justify-between text-[16px]">
            <span className="text-amber-200">今週の告知・匂わせ</span>
            <span className="text-neutral-500">{range}</span>
          </div>
          {weekNotices.length === 0 ? (
            <div className="text-[16px] text-neutral-500">どの店も、今週は静かだ。</div>
          ) : (
            <ul className="space-y-0.5 text-[15px]">
              {weekNotices.slice(0, 7).map((w) => (
                <li key={`${w.date}-${w.parlorId}`} className="flex gap-3">
                  <span className="w-[6.5em] shrink-0 text-neutral-400">{short(w.date)}</span>
                  <span className="w-[11em] shrink-0 truncate">{w.name}</span>
                  <span className="truncate text-amber-100">
                    ［{w.notice.medium}］{w.notice.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {message}
      <PcWindow tabs={['LEDGER', 'CHART', 'SHOP_DATA', 'SHOP_STATS']} />
    </>
  );
}
