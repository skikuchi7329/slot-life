import { useState } from 'react';
import { counterFlags, MACHINES } from '../../data/machines';
import { useGameStore } from '../../stores/useGameStore';
import { DATA_SITE_DATE, useShopDataStore } from '../../stores/useShopDataStore';
import type { DaySnapshot } from '../../types';
import { cn } from '../../utils/cn';
import { dateLabel, num, odds, parseDate } from '../../utils/format';

const cell = 'border border-[#d8d8d8] px-1.5 py-0.5 whitespace-nowrap';
const head = 'border border-[#a0a0a0] bg-[#d4d0c8] px-1.5 font-normal text-[#333]';

/** 差枚に付ける条件付き書式（表計算ソフトのカラースケール風） */
function diffColor(diff: number): string {
  if (diff >= 2000) return 'bg-[#a8e0a0]';
  if (diff >= 500) return 'bg-[#d6f0d0]';
  if (diff <= -2000) return 'bg-[#f0b0b0]';
  if (diff <= -500) return 'bg-[#f8dcdc]';
  return '';
}

function ParlorTabs({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const parlors = useGameStore((s) => s.parlors);
  return (
    <div className="flex flex-wrap gap-1 bg-[#d4d0c8] p-1 font-sheet text-[12px]">
      {parlors.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={cn('border border-[#808080] px-2 py-0.5 text-black', value === p.id ? 'bg-white font-bold' : 'bg-[#e4e0d8]')}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** 店のデータ：ある日の閉店後の全台データ */
export function ShopDataSheet() {
  const parlors = useGameStore((s) => s.parlors);
  const today = useGameStore((s) => s.player.currentDate);
  const data = useShopDataStore((s) => s.data);
  // 最初は、いちばん新しいデータがある店を開く（たいていは今日行った店）
  const [parlorId, setParlorId] = useState(
    () => [...parlors].sort((a, b) => (data[b.id]?.[0]?.date ?? '').localeCompare(data[a.id]?.[0]?.date ?? ''))[0]?.id ?? '',
  );
  const days = data[parlorId] ?? [];
  const [date, setDate] = useState<string | null>(null);
  const snap: DaySnapshot | undefined = days.find((d) => d.date === date) ?? days[0];

  return (
    <div className="font-sheet text-[13px] text-black">
      <ParlorTabs value={parlorId} onChange={(id) => (setParlorId(id), setDate(null))} />
      <div className="flex flex-wrap gap-1 bg-[#ece9e2] p-1 text-[12px]">
        {days.length === 0 && (
          <span className="px-2 text-[#555]">
            記録がない。{today < DATA_SITE_DATE ? 'この時代は、自分が行った日のデータしか残らない。' : ''}
          </span>
        )}
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setDate(d.date)}
            className={cn('border border-[#a0a0a0] px-1.5', snap?.date === d.date ? 'bg-[#0a246a] text-white' : 'bg-white')}
          >
            {dateLabel(d.date).slice(5)}
            {d.notice ? '★' : ''}
          </button>
        ))}
      </div>
      {snap && (
        <>
          <div className="bg-[#fffbe0] px-2 py-1 text-[12px]">
            {dateLabel(snap.date)} ／ 告知：{snap.notice ?? 'なし'}
          </div>
          <table className="border-collapse bg-white tabular-nums">
            <thead>
              <tr>
                {['台番', '機種', 'G数', 'ボーナス1', 'ボーナス2', '合算', '差枚'].map((h) => (
                  <th key={h} className={head}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snap.units.map(([unitNo, mi, games, b1, b2, diff]) => {
                const m = MACHINES[mi];
                const [f1, f2] = m ? counterFlags(m) : [];
                return (
                  <tr key={unitNo}>
                    <td className={cn(cell, 'text-right')}>{unitNo}</td>
                    <td className={cell}>{m?.name ?? '?'}</td>
                    <td className={cn(cell, 'text-right')}>{games ? num(games) : ''}</td>
                    <td className={cn(cell, 'text-right')}>{games ? `${f1?.label ?? ''} ${b1}` : ''}</td>
                    <td className={cn(cell, 'text-right')}>{games && f2 ? `${f2.label} ${b2}` : ''}</td>
                    <td className={cn(cell, 'text-right')}>{games ? odds(b1 + b2, games) : ''}</td>
                    <td className={cn(cell, 'text-right', diff < 0 && 'text-[#d00000]', diffColor(diff))}>{games ? num(diff) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 店舗別：日付の末尾・曜日ごとの平均差枚。強い日の決まりを探す */
export function ShopStatsSheet() {
  const parlors = useGameStore((s) => s.parlors);
  const data = useShopDataStore((s) => s.data);

  const avg = (snaps: DaySnapshot[]) => {
    const units = snaps.flatMap((s) => s.units.filter((u) => u[2] > 0));
    return units.length ? Math.round(units.reduce((a, u) => a + u[5], 0) / units.length) : null;
  };

  const columns = [
    ...Array.from({ length: 10 }, (_, d) => ({ label: `末尾${d}`, test: (iso: string) => parseDate(iso).getDate() % 10 === d })),
    { label: 'ゾロ目', test: (iso: string) => [11, 22].includes(parseDate(iso).getDate()) },
    ...WEEKDAYS.map((w, i) => ({ label: w, test: (iso: string) => parseDate(iso).getDay() === i })),
  ];

  return (
    <div className="font-sheet text-[13px] text-black">
      <div className="bg-[#fffbe0] px-2 py-1 text-[12px]">1台あたりの平均差枚（閉店後データより）。緑が濃いほど、その日に出している。</div>
      <table className="border-collapse bg-white tabular-nums">
        <thead>
          <tr>
            <th className={head}>店</th>
            <th className={head}>日数</th>
            {columns.map((c) => (
              <th key={c.label} className={head}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parlors.map((p) => {
            const snaps = data[p.id] ?? [];
            return (
              <tr key={p.id}>
                <td className={cell}>{p.name}</td>
                <td className={cn(cell, 'text-right')}>{snaps.length}</td>
                {columns.map((c) => {
                  const v = avg(snaps.filter((s) => c.test(s.date)));
                  return (
                    <td key={c.label} className={cn(cell, 'text-right', v !== null && v < 0 && 'text-[#d00000]', v !== null && diffColor(v * 2))}>
                      {v === null ? '' : num(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
