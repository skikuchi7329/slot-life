import type { ReactNode } from 'react';

/**
 * ドット絵の描画ユーティリティ。
 * シーンはすべて 320×180 の論理ピクセル（= ステージ1280×720の1/4）で描き、SVGで4倍表示する。
 */
export const VB_W = 320;
export const VB_H = 180;

export function PixelCanvas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={1280}
      height={720}
      className={`pixelated absolute inset-0 ${className ?? ''}`}
      shapeRendering="crispEdges"
    >
      {children}
    </svg>
  );
}

export function Px({ x, y, w = 1, h = 1, c, o }: { x: number; y: number; w?: number; h?: number; c: string; o?: number }) {
  return <rect x={x} y={y} width={w} height={h} fill={c} opacity={o} />;
}

export type Palette = Record<string, string>;

/**
 * 文字列グリッドのスプライト。'.' は透明、それ以外は palette の色。
 * 横に同色が続く部分は1つの rect にまとめて描画数を減らす。
 */
export function Sprite({ x, y, rows, palette, scale = 1 }: { x: number; y: number; rows: string[]; palette: Palette; scale?: number }) {
  const rects: ReactNode[] = [];
  rows.forEach((row, ry) => {
    let start = 0;
    for (let rx = 1; rx <= row.length; rx++) {
      if (rx === row.length || row[rx] !== row[start]) {
        const ch = row[start];
        const color = palette[ch];
        if (ch !== '.' && color) {
          rects.push(
            <rect key={`${ry}-${start}`} x={x + start * scale} y={y + ry * scale} width={(rx - start) * scale} height={scale} fill={color} />,
          );
        }
        start = rx;
      }
    }
  });
  return <g>{rects}</g>;
}
