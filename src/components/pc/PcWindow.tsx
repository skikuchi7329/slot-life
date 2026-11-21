import { useEffect } from 'react';
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useLogStore } from '../../stores/useLogStore';
import { useRunStore } from '../../stores/useRunStore';
import { useUiStore, type PcTab } from '../../stores/useUiStore';
import type { ActionType, DayLog, RunRecord } from '../../types';
import { cn } from '../../utils/cn';
import { dateLabel, num, signedYen } from '../../utils/format';
import { Sheet, type Column } from './Sheet';

const ACTION_LABEL: Record<ActionType, string> = { SETTING: '設定狙い', HYENA: 'ハイエナ', TECH: '技術介入', REST: '休み' };

// 白背景用に検証済みのカテゴリカル配色（先頭2色）
const EV_COLOR = '#2a78d6';
const ACTUAL_COLOR = '#eb6834';

const TAB_LABEL: Record<PcTab, string> = { LEDGER: '収支表', CHART: 'グラフ', ANSWER: '答え合わせ', GRAVES: '墓標' };
const FILE_NAME: Record<PcTab, string> = { LEDGER: '収支表.xls', CHART: '収支表.xls', ANSWER: '収支表.xls', GRAVES: 'これまでの人生.xls' };

const ledgerColumns: Column<DayLog>[] = [
  { header: '日付', cell: (l) => dateLabel(l.date) },
  { header: '区分', cell: (l) => ACTION_LABEL[l.actionType] },
  { header: '店舗', cell: (l) => l.parlorName },
  { header: '機種/台', cell: (l) => l.machineName },
  { header: 'G数', align: 'right', cell: (l) => (l.gamesPlayed ? num(l.gamesPlayed) : '') },
  { header: '推定設定', align: 'right', cell: (l) => l.estimatedSetting?.toFixed(1) ?? '' },
  { header: '投資', align: 'right', cell: (l) => (l.cashInvested ? num(l.cashInvested) : '') },
  { header: '推定期待値', align: 'right', cell: (l) => (l.actionType === 'REST' ? '' : signedYen(l.expectedValue)), negative: (l) => l.expectedValue < 0 },
  { header: '実収支', align: 'right', cell: (l) => (l.actionType === 'REST' ? '' : signedYen(l.actualProfit)), negative: (l) => l.actualProfit < 0 },
  {
    header: '乖離',
    align: 'right',
    cell: (l) => (l.actionType === 'REST' ? '' : signedYen(l.actualProfit - l.expectedValue)),
    negative: (l) => l.actualProfit < l.expectedValue,
  },
  { header: 'σ', align: 'right', cell: (l) => (l.sigma ? num(l.sigma) : '') },
  { header: 'メモ', cell: (l) => l.memo },
];

const answerColumns: Column<DayLog>[] = [
  { header: '日付', cell: (l) => dateLabel(l.date) },
  { header: '機種/台', cell: (l) => l.machineName },
  { header: '推定設定', align: 'right', cell: (l) => l.estimatedSetting?.toFixed(1) ?? '' },
  { header: '真の設定', align: 'right', cell: (l) => l.trueSetting ?? '' },
  { header: '記帳EV', align: 'right', cell: (l) => signedYen(l.expectedValue), negative: (l) => l.expectedValue < 0 },
  { header: '真のEV', align: 'right', cell: (l) => signedYen(l.trueExpectedValue), negative: (l) => l.trueExpectedValue < 0 },
  { header: '実収支', align: 'right', cell: (l) => signedYen(l.actualProfit), negative: (l) => l.actualProfit < 0 },
];

const graveColumns: Column<RunRecord>[] = [
  { header: '出自', cell: (r) => r.traitName },
  { header: '最期の日', cell: (r) => dateLabel(r.endDate) },
  { header: '稼働日数', align: 'right', cell: (r) => num(r.workDays) },
  { header: '最終所持金', align: 'right', cell: (r) => num(r.finalCash), negative: (r) => r.finalCash < 0 },
  { header: '記帳EV計', align: 'right', cell: (r) => signedYen(r.totalEv), negative: (r) => r.totalEv < 0 },
  { header: '真のEV計', align: 'right', cell: (r) => signedYen(r.totalTrueEv), negative: (r) => r.totalTrueEv < 0 },
  { header: '実収支計', align: 'right', cell: (r) => signedYen(r.totalActual), negative: (r) => r.totalActual < 0 },
  { header: '最期', cell: (r) => r.reason },
];

function sum(logs: DayLog[], f: (l: DayLog) => number) {
  return logs.reduce((a, l) => a + f(l), 0);
}

function ChartSheet({ logs }: { logs: DayLog[] }) {
  const data = logs.reduce(
    (rows, l) => {
      const prev = rows[rows.length - 1];
      rows.push({ label: dateLabel(l.date), ev: prev.ev + l.expectedValue, actual: prev.actual + l.actualProfit });
      return rows;
    },
    [{ label: '開始', ev: 0, actual: 0 }],
  );
  if (logs.length === 0) return <p className="p-6 font-sheet text-[14px] text-neutral-500">データがありません。</p>;
  return (
    <div className="bg-white p-3">
      <div className="mb-1 text-center font-sheet text-[15px] font-bold text-black">積算期待値（推定）と実収支の推移</div>
      <LineChart width={920} height={360} data={data} margin={{ top: 8, right: 20, bottom: 4, left: 12 }}>
        <CartesianGrid stroke="#e5e5e5" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#999' }} minTickGap={50} />
        <YAxis tick={{ fill: '#555', fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => signedYen(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="linear" dataKey="ev" name="積算期待値（推定）" stroke={EV_COLOR} strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
        <Line type="linear" dataKey="actual" name="実収支" stroke={ACTUAL_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </div>
  );
}

/** 部屋のPCで開く表計算ソフトの窓 */
export function PcWindow({ tabs }: { tabs: PcTab[] }) {
  const tab = useUiStore((s) => s.pcTab);
  const openPc = useUiStore((s) => s.openPc);
  const closePc = useUiStore((s) => s.closePc);
  const logs = useLogStore((s) => s.logs);
  const runs = useRunStore((s) => s.runs);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePc();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePc]);

  if (!tab) return null;
  const settingLogs = logs.filter((l) => l.trueSetting !== null);
  const work = logs.filter((l) => l.actionType !== 'REST');

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
      <div className="flex h-[620px] w-[1060px] flex-col border-2 border-[#d4d0c8] bg-[#d4d0c8] shadow-[4px_4px_0_#000]">
        {/* タイトルバー */}
        <div className="flex h-7 items-center bg-gradient-to-r from-[#0a246a] to-[#3a6ea5] px-2 font-sheet text-[13px] text-white">
          <span className="font-bold">{FILE_NAME[tab]} - 表計算</span>
          <button type="button" onClick={closePc} className="ml-auto h-5 w-6 border border-white/60 bg-[#d4d0c8] text-[12px] leading-none text-black">
            ×
          </button>
        </div>
        <div className="flex gap-4 border-b border-[#a0a0a0] px-2 py-0.5 font-sheet text-[12px] text-black">
          {['ファイル(F)', '編集(E)', '表示(V)', '挿入(I)', '書式(O)', 'ツール(T)', 'データ(D)'].map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 border-b border-[#a0a0a0] bg-white px-2 py-0.5 font-sheet text-[12px] text-black">
          <span className="w-14 border-r border-[#a0a0a0] text-[#555]">H{logs.length + 2}</span>
          <span className="text-[#555]">fx</span>
          <span>{tab === 'GRAVES' ? `=COUNTA(A2:A${runs.length + 1})` : `=SUM(H2:H${logs.length + 1})`}</span>
        </div>

        <div className="flex-1 overflow-auto bg-[#808080]">
          {tab === 'LEDGER' && (
            <Sheet
              columns={ledgerColumns}
              rows={[...logs].reverse()}
              footer={[
                '合計',
                `${work.length}日稼働`,
                '',
                '',
                '',
                '',
                '',
                signedYen(sum(logs, (l) => l.expectedValue)),
                signedYen(sum(logs, (l) => l.actualProfit)),
                signedYen(sum(logs, (l) => l.actualProfit - l.expectedValue)),
                '',
                '',
              ]}
            />
          )}
          {tab === 'CHART' && <ChartSheet logs={logs} />}
          {tab === 'ANSWER' && (
            <Sheet
              columns={answerColumns}
              rows={settingLogs}
              footer={[
                '合計',
                '',
                '',
                '',
                signedYen(sum(settingLogs, (l) => l.expectedValue)),
                signedYen(sum(settingLogs, (l) => l.trueExpectedValue)),
                signedYen(sum(settingLogs, (l) => l.actualProfit)),
              ]}
            />
          )}
          {tab === 'GRAVES' && <Sheet columns={graveColumns} rows={[...runs].reverse()} />}
        </div>

        {/* シートタブ */}
        <div className="flex h-7 items-end gap-0.5 px-2 font-sheet text-[12px]">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => openPc(t)}
              className={cn(
                'border border-b-0 border-[#808080] px-4 py-0.5 text-black',
                t === tab ? 'bg-white font-bold' : 'bg-[#c0bcb4]',
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
          <span className="ml-auto self-center text-[#333]">Esc で閉じる</span>
        </div>
      </div>
    </div>
  );
}
