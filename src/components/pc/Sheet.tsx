import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface Column<T> {
  header: string;
  align?: 'left' | 'right';
  width?: number;
  cell: (row: T) => ReactNode;
  /** 値が負なら赤字（表計算ソフトの会計書式） */
  negative?: (row: T) => boolean;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 古い表計算ソフト風のグリッド。列記号・行番号・会計書式の赤字を再現する */
export function Sheet<T>({ columns, rows, footer }: { columns: Column<T>[]; rows: T[]; footer?: ReactNode[] }) {
  return (
    <table className="border-collapse font-sheet text-[13px] text-black tabular-nums">
      <thead className="sticky top-0 z-10">
        <tr className="bg-[#d4d0c8] text-[#333]">
          <th className="w-9 border border-[#a0a0a0]" />
          {columns.map((c, i) => (
            <th key={c.header} className="border border-[#a0a0a0] px-1 font-normal" style={{ width: c.width }}>
              {LETTERS[i]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="bg-[#eef1e6]">
          <td className="border border-[#a0a0a0] bg-[#d4d0c8] text-center text-[#333]">1</td>
          {columns.map((c) => (
            <td key={c.header} className="border border-[#c8c8c8] px-1.5 py-0.5 text-center font-bold whitespace-nowrap">
              {c.header}
            </td>
          ))}
        </tr>
        {rows.map((r, ri) => (
          <tr key={ri} className="bg-white">
            <td className="border border-[#a0a0a0] bg-[#d4d0c8] text-center text-[#333]">{ri + 2}</td>
            {columns.map((c) => (
              <td
                key={c.header}
                className={cn(
                  'max-w-[220px] truncate border border-[#d8d8d8] px-1.5 py-0.5 whitespace-nowrap',
                  c.align === 'right' && 'text-right',
                  c.negative?.(r) && 'text-[#d00000]',
                )}
              >
                {c.cell(r)}
              </td>
            ))}
          </tr>
        ))}
        {footer && (
          <tr className="bg-[#fffbe0] font-bold">
            <td className="border border-[#a0a0a0] bg-[#d4d0c8] text-center text-[#333]">{rows.length + 2}</td>
            {footer.map((f, i) => (
              <td key={i} className={cn('border border-[#c8c8c8] px-1.5 py-0.5 whitespace-nowrap', i > 0 && 'text-right')}>
                {f}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}
