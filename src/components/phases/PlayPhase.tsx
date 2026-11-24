import { useEffect, useState } from 'react';
import { getEnvironment } from '../../data/eras';
import { counterFlags, getMachine, handCounterFlags, noteFlags } from '../../data/machines';
import { currentData, isFree } from '../../engine/floor';
import { expectedCoinsPerGame, settingPosterior } from '../../engine/simulation';
import { CLOSE_TIME, useGameStore } from '../../stores/useGameStore';
import { hasPerk } from '../../stores/useRunStore';
import type { Flag, FloorEvent, FloorUnit, Machine, MachineType, PlaySession, Today } from '../../types';
import { playConfirm, playFreeze } from '../../utils/audio';
import { cn } from '../../utils/cn';
import { clockLabel, num, odds, yen } from '../../utils/format';
import { HitEffect } from '../effects/HitEffect';
import { hitKindFor } from '../effects/hitKind';
import { Hud } from '../game/Hud';
import { MessageWindow, type Choice } from '../game/MessageWindow';
import { UnitStrip } from '../parlor/UnitStrip';
import { FloorScene } from '../scenes/FloorScene';
import { MachineScene } from '../scenes/MachineScene';
import { NoticeCard } from '../parlor/NoticeCard';

/** 台の上のデータカウンター（当日分） */
function DataCounter({ machine, session }: { machine: Machine; session: PlaySession }) {
  return (
    <div className="absolute top-[68px] left-1/2 z-10 w-[360px] -translate-x-1/2 border-4 border-[#111] bg-[#050505] px-3 py-2">
      <div className="flex justify-between text-[14px] text-neutral-500">
        <span>DATA COUNTER</span>
        <span className="text-amber-300">#{session.unitNo}</span>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        {counterFlags(machine)
          .slice(0, 2)
          .map((f) => (
            <div key={f.key}>
              <div className="truncate text-[13px] text-neutral-500">{f.label}</div>
              <div className="lcd text-[26px]">{session.counts[f.key] ?? 0}</div>
            </div>
          ))}
        <div>
          <div className="text-[13px] text-neutral-500">総回転</div>
          <div className="lcd text-[26px]">{num(session.games)}</div>
        </div>
      </div>
    </div>
  );
}

/** 手元の小役カウンター（通称カチカチ君）。持っていなければ、小役は目で追うだけ */
function HandCounter({ machine, session, owned }: { machine: Machine; session: PlaySession; owned: boolean }) {
  const data = new Set(counterFlags(machine).map((f) => f.key));
  return (
    <div className="absolute top-[150px] left-8 z-10 w-[310px] rounded-2xl border-4 border-[#2b2b2b] bg-[#5b5f68] p-3 shadow-[6px_6px_0_rgb(0_0_0/0.5)]">
      <div className="mb-2 text-center text-[15px] text-neutral-200">{owned ? '小役カウンター' : '手元のメモ（カウンターなし）'}</div>
      <div className={cn('space-y-1.5 rounded p-2', owned ? 'bg-[#9fae8f] text-[#1c2416]' : 'bg-[#3a3d44] text-neutral-300')}>
        {handCounterFlags(machine).map((f) =>
          owned || data.has(f.key) ? (
            <div key={f.key} className="flex justify-between text-[19px] tabular-nums">
              <span className="truncate">{f.label}</span>
              <span className="shrink-0">
                {session.counts[f.key] ?? 0}
                <span className="ml-2 text-[15px]">{odds(session.counts[f.key] ?? 0, session.games)}</span>
              </span>
            </div>
          ) : (
            <div key={f.key} className="flex justify-between text-[19px] text-neutral-500">
              <span className="truncate">{f.label}</span>
              <span className="shrink-0 text-[15px]">数えていない</span>
            </div>
          ),
        )}
      </div>
      <div className="mt-2 flex justify-between text-[15px] text-neutral-200 tabular-nums">
        <span>持ちメダル {num(session.coinsInHand)}枚</span>
        <span>投資 {num(session.cashInvested / 1000)}k</span>
      </div>
    </div>
  );
}

function hintNote(f: Flag, insight: boolean): string {
  if (f.kind === 'PREMIUM') return 'プレミア';
  if (f.published !== false) return f.meaning ?? '';
  return insight ? `${f.meaning} → ガセ` : `${f.meaning}？`;
}

/** 自作の判別メモ（方眼ノート）。判別ツールの事後確率と、見た示唆の記録 */
function Notebook({ machine, session, rate, handCounter }: { machine: Machine; session: PlaySession; rate: number; handCounter: boolean }) {
  const insight = hasPerk('HINT_INSIGHT');
  const posterior =
    session.games > 0 ? settingPosterior(machine, session.games, session.counts, undefined, handCounter) : [1, 1, 1, 1, 1, 1].map(() => 1 / 6);
  const hourly = posterior.reduce((a, p, i) => a + p * expectedCoinsPerGame(machine, i + 1), 0) * machine.gamesPerHour * rate;
  const seen = noteFlags(machine).filter((f) => (session.counts[f.key] ?? 0) > 0);
  return (
    <div
      className="absolute top-[72px] right-8 z-10 w-[340px] rotate-[1.5deg] border border-[#b8b0a0] p-4 text-[#2a2a2a] shadow-[6px_6px_0_rgb(0_0_0/0.5)]"
      style={{
        backgroundColor: '#f2eee2',
        backgroundImage: 'linear-gradient(#d9e3ec 1px, transparent 1px), linear-gradient(90deg, #d9e3ec 1px, transparent 1px)',
        backgroundSize: '12px 12px',
      }}
    >
      <div className="mb-2 flex justify-between text-[17px]">
        <span>設定判別メモ</span>
        <span className={hourly < 0 ? 'text-[#c02020]' : ''}>時給 {yen(hourly)}?</span>
      </div>
      {posterior.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[16px] tabular-nums">
          <span className="w-8">設{i + 1}</span>
          <div className="h-3 flex-1 bg-[#e4dfd2]">
            <div className={cn('h-3', i >= 3 ? 'bg-[#c0392b]' : 'bg-[#555]')} style={{ width: `${p * 100}%` }} />
          </div>
          <span className="w-12 text-right">{Math.round(p * 100)}%</span>
        </div>
      ))}
      {seen.length > 0 && (
        <ul className="mt-2 border-t border-dashed border-[#999] pt-1 text-[14px]">
          {seen.slice(0, 4).map((f) => (
            <li key={f.key} className={cn('flex justify-between gap-2', f.published === false && 'text-[#888]')}>
              <span className="truncate">
                {f.label}×{session.counts[f.key]}
              </span>
              <span className="shrink-0">{hintNote(f, insight)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 暗転・フリーズ・確定演出。派手にせず、ただ画面が黙る */
function PremiumOverlay({ flag, onClose }: { flag: Flag; onClose: () => void }) {
  const confirm = flag.style === 'CONFIRM';
  useEffect(() => {
    if (confirm) playConfirm();
    else playFreeze();
  }, [confirm]);
  return (
    <>
      <div className={cn('scene-fade absolute inset-0 z-[15]', confirm ? 'bg-black/80' : 'bg-black')} />
      {confirm && (
        <div className="scene-fade absolute top-[200px] left-1/2 z-[16] -translate-x-1/2 text-center">
          <div className="text-[18px] tracking-[0.5em] text-neutral-500">{flag.label}</div>
          <div className="mt-3 text-[54px] tracking-widest text-neutral-100" style={{ textShadow: '0 0 16px rgb(255 255 255 / 0.4)' }}>
            {flag.meaning}
          </div>
        </div>
      )}
      <MessageWindow text={confirm ? `${flag.text}\n……${flag.meaning}。` : (flag.text ?? '')} choices={[{ label: '……', onSelect: onClose }]} />
    </>
  );
}

function neighborTypes(seed: number): [MachineType, MachineType] {
  const types: MachineType[] = ['A_TYPE', 'AT_HIGH_SPEC', 'SMASLOT', 'TECH'];
  return [types[seed % 4], types[(seed + 1) % 4]];
}

/** 直近1時間に見えた示唆を、地の文にする */
function hintLines(machine: Machine, lastCounts: Record<string, number>): string[] {
  const insight = hasPerk('HINT_INSIGHT');
  return machine.flags
    .filter((f) => f.kind === 'HINT' && !f.style && (lastCounts[f.key] ?? 0) > 0)
    .map((f) =>
      f.published !== false
        ? `${f.text}（${f.meaning}）`
        : `${f.text}……${f.meaning}、らしい。${insight ? '（設定差はほぼない。ガセだ）' : ''}`,
    );
}

function briefData(u: FloorUnit, t: number): string {
  const d = currentData(u, t);
  const flags = counterFlags(getMachine(u.machineId))
    .map((f) => `${f.label}${d.counts[f.key] ?? 0}回`)
    .join(' ');
  return `${num(d.games)}G ${flags}`;
}

/** 島で起きた出来事の選択肢 */
function FloorEventWindow({ event, today, clock }: { event: FloorEvent; today: Today; clock: number }) {
  const resolve = useGameStore((s) => s.resolveFloorEvent);
  const unit = 'unitNo' in event ? today.floor.find((u) => u.unitNo === event.unitNo) : undefined;
  if (event.kind === 'YAME' && unit) {
    return (
      <MessageWindow
        speaker="島"
        text={`#${unit.unitNo}（${getMachine(unit.machineId).name}）の客が席を立った。\n${briefData(unit, clock)}。`}
        choices={[
          { label: 'その台に移る', onSelect: () => resolve(true) },
          { label: '気にしない', onSelect: () => resolve(false) },
        ]}
      />
    );
  }
  if (event.kind === 'NEIGHBOR_CONFIRM' && unit) {
    return (
      <MessageWindow
        speaker="隣の台"
        text={`隣の#${unit.unitNo}の客が、何も言わずに席を立った。\n液晶には「${event.label}」が残っている。……${event.meaning}。`}
        choices={[
          { label: '移る（今の台を捨てる）', onSelect: () => resolve(true) },
          { label: '気にしない', onSelect: () => resolve(false) },
        ]}
      />
    );
  }
  if (event.kind === 'BUYOUT') {
    return (
      <MessageWindow
        speaker="若い男"
        text={`背後から声をかけられた。「その台、${event.price.toLocaleString()}円で譲ってくれない？」\n男の後ろに、仲間らしき数人が立っている。`}
        choices={[
          { label: '売って帰る', sub: `+${event.price.toLocaleString()}円`, onSelect: () => resolve(true) },
          { label: '断る', onSelect: () => resolve(false) },
        ]}
      />
    );
  }
  return (
    <MessageWindow
      speaker="島"
      text="店員が島の端で、台番をメモしている。\n明日の設定を考えているのかもしれない。"
      choices={[{ label: '……', onSelect: () => resolve(false) }]}
    />
  );
}

/** 島を見て回り、空いた台（ヤメ台）に移る */
function WalkView({ today, session, seed, onBack }: { today: Today; session: PlaySession; seed: string; onBack: () => void }) {
  const moveTo = useGameStore((s) => s.moveTo);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const t = session.clock;
  const target = today.floor.find((u) => u.unitNo === selected);
  const panel = today.floor.find((u) => u.unitNo === (hovered ?? selected));
  const free = today.floor.filter((u) => u.unitNo !== session.unitNo && isFree(u, t));
  const panelToday =
    panel && panel.unitNo === session.unitNo ? { games: session.games, counts: session.counts, coinDiff: session.coinDiff } : panel ? currentData(panel, t) : undefined;

  return (
    <>
      <FloorScene floor={today.floor} seed={seed} highlighted={hovered ?? selected ?? session.unitNo} interactive onHover={setHovered} onSelect={setSelected} at={t} />
      <Hud clock={t} />
      {today.notice && <NoticeCard medium={today.notice.medium} text={today.notice.text} />}
      {panel && (
        <UnitStrip
          unit={panel}
          today={panelToday}
          status={
            panel.unitNo === session.unitNo
              ? '自分の台'
              : today.runnerShifts?.some((x) => x.unitNo === panel.unitNo) && !isFree(panel, t)
                ? '打ち子'
                : isFree(panel, t)
                  ? '空き'
                  : '着席中'
          }
        />
      )}
      {target ? (
        <MessageWindow
          text={`#${target.unitNo} ${getMachine(target.machineId).name}に移る？\n今の台のデータは、ここで打ち切りになる。`}
          choices={[
            { label: '移る', onSelect: () => (moveTo(target.unitNo), onBack()) },
            { label: 'やめる', onSelect: () => setSelected(null) },
          ]}
        />
      ) : (
        <MessageWindow
          text={`島を見て回る。空き台は ${free.length}台。\n他の台のデータカウンターに、店の意図が見えるかもしれない。（空き台をクリックで移動）`}
          choices={[{ label: '自分の台に戻る', onSelect: onBack }]}
        />
      )}
    </>
  );
}

export function PlayPhase() {
  const today = useGameStore((s) => s.today);
  const date = useGameStore((s) => s.player.currentDate);
  const handCounter = useGameStore((s) => s.inventory.owned.includes('HAND_COUNTER'));
  const playHour = useGameStore((s) => s.playHour);
  const playToClose = useGameStore((s) => s.playToClose);
  const endSession = useGameStore((s) => s.endSession);
  const switchToHyena = useGameStore((s) => s.switchToHyena);
  // 見終えた演出（台番と時間の組で管理する。台を移ると記録がリセットされるため）
  const [seenPremium, setSeenPremium] = useState('');
  const [seenHit, setSeenHit] = useState('');
  const [walking, setWalking] = useState(false);
  const s = today?.session;
  if (!today || !s) return null;

  const env = getEnvironment(date);
  const closed = s.clock >= CLOSE_TIME;
  const machine = s.machineId ? getMachine(s.machineId) : null;
  const last = s.log[s.log.length - 1];
  const lastCounts = s.lastCounts ?? {};
  const seed = `${date}-${today.parlorId}`;
  const moment = `${s.unitNo}:${s.log.length}`;

  const choices: Choice[] = closed
    ? [{ label: '閉店。精算して帰る', onSelect: endSession }]
    : [
        { label: machine ? '1時間回す' : '1時間巡回する', onSelect: playHour },
        { label: `閉店（${clockLabel(CLOSE_TIME)}）まで${machine ? '回す' : '粘る'}`, sub: machine ? '何か起きたら止まる' : undefined, onSelect: playToClose },
        ...(machine
          ? [
              { label: '島を見て回る', sub: '空き台に移れる', onSelect: () => setWalking(true) },
              { label: '見切ってハイエナに切り替える', sub: '店マーク↑', onSelect: switchToHyena },
            ]
          : []),
        { label: 'ヤメて精算する', onSelect: endSession },
      ];

  if (!machine) {
    return (
      <>
        <FloorScene floor={today.floor} seed={seed} interactive={false} at={s.clock} />
        <Hud clock={s.clock} />
        <MessageWindow
          text={
            last
              ? `${last}\n天井の近い台、ゾーン狙い。拾えるものを拾って歩く。`
              : '島を歩き回る。ゲーム数の深い台、ヤメられた直後の台……。\n店員の視線が、少しずつ痛くなる。'
          }
          choices={choices}
        />
      </>
    );
  }

  if (walking && !closed) return <WalkView today={today} session={s} seed={seed} onBack={() => setWalking(false)} />;

  const hit = counterFlags(machine).some((f) => (lastCounts[f.key] ?? 0) > 0);
  const premium = s.log.length > 0 ? machine.flags.find((f) => f.style && (lastCounts[f.key] ?? 0) > 0) : undefined;
  const hitKind = s.log.length > 0 ? hitKindFor(machine, lastCounts, s.lastDiff ?? 0) : null;
  const hints = hintLines(machine, lastCounts);

  const flavor = closed
    ? '蛍の光が流れている。'
    : !last
      ? 'サンドに千円札を入れる。今日も長い一日になる。'
      : hints.length > 0
        ? hints[0]
        : hit
          ? (s.lastDiff ?? 0) >= 1500
            ? '出た。今日いちばんの波だ。……それでも、期待値の一部にすぎない。'
            : machine.type === 'A_TYPE'
              ? 'ペカッ。……淡々と揃える。'
              : '当たった。だが、これが何を意味するかはまだ分からない。'
          : '淡々と回す。レバーを叩く右手だけが動いている。';

  let overlay;
  if (premium && seenPremium !== moment) overlay = <PremiumOverlay flag={premium} onClose={() => setSeenPremium(moment)} />;
  else if (hitKind && seenHit !== moment)
    overlay = <HitEffect kind={hitKind} machine={machine} lastCounts={lastCounts} lastDiff={s.lastDiff ?? 0} onDone={() => setSeenHit(moment)} />;
  else if (today.floorEvent) overlay = <FloorEventWindow event={today.floorEvent} today={today} clock={s.clock} />;
  else overlay = <MessageWindow speaker={`${machine.name} #${s.unitNo}`} text={`${last ? `${last}\n` : ''}${flavor}`} choices={choices} />;

  return (
    <>
      <MachineScene type={machine.type} neighborTypes={neighborTypes(s.unitNo ?? 0)} lampOn={hit && machine.type === 'A_TYPE'} />
      <Hud clock={s.clock} />
      <DataCounter machine={machine} session={s} />
      <HandCounter machine={machine} session={s} owned={handCounter} />
      <Notebook machine={machine} session={s} rate={env.exchangeRate} handCounter={handCounter} />
      {overlay}
    </>
  );
}
