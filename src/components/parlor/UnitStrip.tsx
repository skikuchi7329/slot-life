import { counterFlags, getMachine } from '../../data/machines';
import type { CounterData, FloorUnit } from '../../types';
import { num, odds, signedCoins } from '../../utils/format';

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[14px] text-neutral-400">{label}</span>
      <span className="lcd px-1.5 text-[18px]">{value}</span>
    </div>
  );
}

function DataRow({ title, data, unit }: { title: string; data: CounterData; unit: FloorUnit }) {
  const m = getMachine(unit.machineId);
  return (
    <div className="flex items-center gap-4">
      <span className="w-[3em] text-[14px] text-neutral-500">{title}</span>
      <Cell label="G" value={num(data.games)} />
      {counterFlags(m).map((f) => (
        <Cell key={f.key} label={f.label} value={`${data.counts[f.key] ?? 0} (${odds(data.counts[f.key] ?? 0, data.games)})`} />
      ))}
      <Cell label="差枚" value={signedCoins(data.coinDiff)} />
    </div>
  );
}

/**
 * 島の間の通路に出すデータカウンターの帯。台を隠さない位置に出す。
 * today を渡すと、当日の途中経過も並べる（島を見て回るとき）
 */
export function UnitStrip({ unit, today, status }: { unit: FloorUnit; today?: CounterData; status: string }) {
  const m = getMachine(unit.machineId);
  return (
    <div className="game-window absolute top-[206px] left-1/2 z-10 w-[1100px] -translate-x-1/2 px-5 py-2">
      <div className="flex items-baseline gap-4">
        <span className="text-[24px] text-amber-300">#{unit.unitNo}</span>
        <span className="text-[18px]">{m.name}</span>
        {unit.corner && <span className="border border-neutral-600 px-1 text-[13px] text-neutral-400">角</span>}
        <span className="ml-auto text-[15px] text-neutral-400">{status}</span>
      </div>
      <div className="mt-1 space-y-1">
        <DataRow title="前日" data={unit.yesterday} unit={unit} />
        {today && <DataRow title="本日" data={today} unit={unit} />}
      </div>
    </div>
  );
}
