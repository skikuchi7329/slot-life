import { useState } from 'react';
import { getItem, itemAvailable, itemPrice, ITEMS, MAX_PULLERS, MAX_RUNNERS, PULLER_WAGE, RUNNER_FLOAT, RUNNER_SHARE, RUNNER_WAGE, wage } from '../../data/items';
import { borrowLimit, TOTAL_VOLUME_REGULATION, useGameStore } from '../../stores/useGameStore';
import type { Inventory, ItemId } from '../../types';
import { useUiStore } from '../../stores/useUiStore';
import { cn } from '../../utils/cn';
import { dateLabel, num, signedYen } from '../../utils/format';
import { Hud } from '../game/Hud';
import { MessageWindow, type Choice } from '../game/MessageWindow';
import { PcWindow } from '../pc/PcWindow';
import { RoomScene } from '../scenes/RoomScene';

type Mode = 'main' | 'money' | 'shop' | 'shopNote' | 'crew';

/** 期間ものの残り週数 */
function weeksLeft(inv: Inventory, id: ItemId, date: string): number {
  const until = inv.until[id];
  if (!until || until <= date) return 0;
  return Math.ceil((Date.parse(until) - Date.parse(date)) / (7 * 86_400_000));
}

/** 買えるものと持ち物の一覧（左の窓） */
function ShopPanel({ date }: { date: string }) {
  const inventory = useGameStore((s) => s.inventory);
  const items = ITEMS.filter((i) => itemAvailable(i, date));
  return (
    <div className="game-window absolute top-[76px] left-6 z-10 w-[600px] px-5 py-3">
      <div className="mb-2 text-[18px] text-amber-200">道具と情報</div>
      <ul className="space-y-1.5">
        {items.map((i) => {
          const owned = i.kind !== 'CONSUMABLE' && inventory.owned.includes(i.id);
          const left = weeksLeft(inventory, i.id, date);
          return (
            <li key={i.id} className="text-[14px] leading-snug">
              <div className="flex justify-between gap-2 text-[16px]">
                <span className={owned || left > 0 ? 'text-amber-300' : 'text-neutral-100'}>
                  {owned ? '✓ ' : ''}
                  {i.name(date)}
                </span>
                <span className="shrink-0 text-neutral-400">
                  {left > 0 ? `あと${left}週 ` : ''}
                  {num(itemPrice(i, date))}円{i.kind === 'SUBSCRIPTION' ? '/月' : ''}
                </span>
              </div>
              <div className="text-neutral-400">{i.description}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 雇っている人（左の窓） */
function CrewPanel({ date }: { date: string }) {
  const crew = useGameStore((s) => s.crew);
  return (
    <div className="game-window absolute top-[76px] left-6 z-10 w-[600px] px-5 py-3 text-[15px]">
      <div className="mb-2 text-[18px] text-amber-200">人を雇う</div>
      <p className="text-neutral-300">どちらも勝負日にだけ連れていく。日当は勝負日ごとに払う。</p>
      <p className="mt-1 text-neutral-300">
        引き子：一緒に抽選に並び、いちばん若い番号を自分が使う。日当{num(wage(PULLER_WAGE, date))}円。
      </p>
      <p className="mt-1 text-neutral-300">
        打ち子：軍資金{num(RUNNER_FLOAT / 10_000)}万円を預ける。自分の次に若い番号で入り、自分が指示した台を打つ。閉店まで打ち切らせるか、見切ったら帰すかも指示する。収支は自分の記帳に入る。日当
        {num(wage(RUNNER_WAGE, date))}円＋勝った日は勝ち分の{RUNNER_SHARE * 10}割。
      </p>
      <p className="mt-1 text-neutral-500">何人も連れて打つと、店に顔を覚えられる。打ち子が軍資金ごと消えることもある。</p>
      <div className="mt-3 border-t border-neutral-700 pt-2">
        <div>
          引き子 {crew.pullers}人 ／ 打ち子 {crew.runners.length}人
        </div>
        <ul className="mt-1 text-neutral-300">
          {crew.runners.map((r) => (
            <li key={r.id}>
              ・{r.name}（{r.since.slice(0, 7).replace('-', '/')}から・軍資金{num(r.float)}円）
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

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
  const inventory = useGameStore((s) => s.inventory);
  const crew = useGameStore((s) => s.crew);
  const parlors = useGameStore((s) => s.parlors);
  const buyItem = useGameStore((s) => s.buyItem);
  const cancelItem = useGameStore((s) => s.cancelItem);
  const hireRunner = useGameStore((s) => s.hireRunner);
  const fireRunner = useGameStore((s) => s.fireRunner);
  const hirePuller = useGameStore((s) => s.hirePuller);
  const firePuller = useGameStore((s) => s.firePuller);
  const [mode, setMode] = useState<Mode>('main');
  const [result, setResult] = useState<string | null>(null);
  if (!week) return null;
  const limit = borrowLimit(player);
  // 週末時点の日付（HUD と同じ）で値段・時代を決める
  const date = week.end;
  const say = (text: string) => text && setResult(text);

  const diff = week.actualProfit - week.expectedValue;
  const lines = [...week.highlights, ...week.notices];

  const back =
    (to: Mode = 'main') =>
    () => (setResult(null), setMode(to));
  const shopChoices: Choice[] = [
    ...ITEMS.filter((i) => itemAvailable(i, date)).map((i): Choice => {
      const price = itemPrice(i, date);
      const owned = i.kind !== 'CONSUMABLE' && inventory.owned.includes(i.id);
      if (owned && i.kind === 'SUBSCRIPTION') return { label: `${i.name(date)}を解約する`, onSelect: () => (cancelItem(i.id), setResult('解約した。')) };
      return {
        label: i.name(date),
        sub: owned ? '持っている' : `${num(price)}円${i.kind === 'SUBSCRIPTION' ? '/月' : ''}`,
        disabled: owned || player.cash < price,
        onSelect: () => (i.id === 'SHOP_NOTE' ? (setResult(null), setMode('shopNote')) : say(buyItem(i.id))),
      };
    }),
    { label: '戻る', onSelect: back() },
  ];

  let message;
  if (result) {
    message = <MessageWindow text={result} choices={[{ label: '……', onSelect: () => setResult(null) }]} />;
  } else if (mode === 'money') {
    message = (
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
          { label: '戻る', onSelect: back() },
        ]}
      />
    );
  } else if (mode === 'shop') {
    message = (
      <MessageWindow
        speaker="通販と本屋"
        text={'深夜のブラウザ。カートに入れては、消す。\n道具は一度買えばずっと使える。情報には期限がある。'}
        choices={shopChoices}
      />
    );
  } else if (mode === 'shopNote') {
    const note = getItem('SHOP_NOTE');
    message = (
      <MessageWindow
        speaker={note.name(date)}
        text={`どの店のことが書かれたものを買う？（${num(itemPrice(note, date))}円）`}
        choices={[
          ...parlors.map((p) => ({
            label: p.name,
            sub: inventory.knownHabits[p.id] ? '読んだことがある' : undefined,
            onSelect: () => (setMode('shop'), say(buyItem('SHOP_NOTE', p.id))),
          })),
          { label: '戻る', onSelect: back('shop') },
        ]}
      />
    );
  } else if (mode === 'crew') {
    message = (
      <MessageWindow
        speaker="人を雇う"
        text={'スロ掲示板に、短い書き込みをする。\n「設定狙いの打ち子・並び募集。日当あり」'}
        choices={[
          {
            label: '引き子を1人増やす',
            sub: `日当${num(wage(PULLER_WAGE, date))}円`,
            disabled: crew.pullers >= MAX_PULLERS,
            onSelect: () => (hirePuller(), setResult('並ぶだけでいいなら、という人が見つかった。')),
          },
          {
            label: '打ち子を雇う',
            sub: `軍資金${num(RUNNER_FLOAT / 10_000)}万 日当${num(wage(RUNNER_WAGE, date))}円＋歩合`,
            disabled: crew.runners.length >= MAX_RUNNERS || player.cash < RUNNER_FLOAT,
            onSelect: () => say(hireRunner()),
          },
          { label: '引き子を1人減らす', disabled: crew.pullers <= 0, onSelect: () => (firePuller(), setResult('もう来なくていい、と連絡した。')) },
          ...crew.runners.map((r) => ({
            label: `${r.name}を解雇`,
            sub: `軍資金${num(r.float / 10_000)}万を返してもらう`,
            onSelect: () => (fireRunner(r.id), setResult(`${r.name}から軍資金を受け取った。「また何かあれば」と言って、帰っていった。`)),
          })),
          { label: '戻る', onSelect: back() },
        ]}
      />
    );
  } else {
    message = (
      <MessageWindow
        text={
          week.highlights.length > 0
            ? '今週もデータカウンターの数字を追い続けた。\n思い出せるのは、いくつかの数字と、あの瞬間だけだ。'
            : '今週もデータカウンターの数字を追い続けた。\n何日だったか、もうよく思い出せない。'
        }
        choices={[
          { label: '眠る', sub: '翌週へ', onSelect: () => nextWeek(false) },
          { label: '求人サイトを眺めてから眠る', sub: '精-7 社会信用+1', onSelect: () => nextWeek(true) },
          { label: '道具・情報を買う', sub: '通販・本屋・note', onSelect: () => setMode('shop') },
          { label: '人を雇う', sub: `引き子${crew.pullers} 打ち子${crew.runners.length}`, onSelect: () => setMode('crew') },
          { label: 'お金の管理', sub: '貯金・借入', onSelect: () => setMode('money') },
          { label: '収支表・店のデータを見る', sub: 'PC', onSelect: () => openPc('SHOP_DATA') },
        ]}
      />
    );
  }

  return (
    <>
      <RoomScene time="night" pcOn seed={player.currentDate} mental={player.mental} />
      <Hud clock={23 * 60 + 30} date={week.end} />

      {(mode === 'shop' || mode === 'shopNote') && <ShopPanel date={date} />}
      {mode === 'crew' && <CrewPanel date={date} />}
      <div className="game-window absolute top-[84px] left-8 z-10 w-[560px] px-6 py-4" hidden={mode === 'shop' || mode === 'shopNote' || mode === 'crew'}>
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
          {(week.crewCost ?? 0) > 0 && (
            <>
              <span className="text-neutral-400">人件費</span>
              <span className="text-right text-red-400">-{num(week.crewCost ?? 0)}円</span>
            </>
          )}
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

      {message}
      <PcWindow tabs={['LEDGER', 'CHART', 'SHOP_DATA', 'SHOP_STATS']} />
    </>
  );
}
