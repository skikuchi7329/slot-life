import { getMachine } from '../../data/machines';
import type { FloorUnit } from '../../types';
import { seeded } from '../../utils/math';
import { PixelCanvas, Px, Sprite } from '../game/Pixel';
import { cabinetPalette, CABINET, COAT_COLORS, SEATED_PERSON } from '../game/sprites';

interface Props {
  floor: FloorUnit[];
  seed: string;
  highlighted?: number | null;
  /** 台を選べるか（ハイエナ巡回中は眺めるだけ） */
  interactive: boolean;
  onHover?: (unitNo: number | null) => void;
  onSelect?: (unitNo: number) => void;
}

const MACHINE_W = 14;
const ROW_Y = [22, 74];

/** ホールの島。2列に並んだ台を正面から見る */
export function FloorScene({ floor, seed, highlighted, interactive, onHover, onSelect }: Props) {
  const perRow = Math.ceil(floor.length / 2);
  const spacing = Math.min(16, 300 / perRow);
  const startX = Math.round((320 - perRow * spacing) / 2);

  return (
    <PixelCanvas className="scene-fade">
      {/* 天井と照明 */}
      <Px x={0} y={0} w={320} h={20} c="#121017" />
      {Array.from({ length: 8 }, (_, i) => (
        <Px key={i} x={14 + i * 40} y={15} w={22} h={2} c="#efe6c8" o={0.8} />
      ))}
      {/* カーペット */}
      <Px x={0} y={20} w={320} h={160} c="#2a1b2c" />
      {Array.from({ length: 60 }, (_, i) => (
        <Px key={i} x={(i * 37) % 320} y={20 + ((i * 53) % 150)} w={2} h={1} c="#3b2740" />
      ))}
      {/* 島の土台 */}
      {ROW_Y.map((y) => (
        <Px key={y} x={startX - 4} y={y + 25} w={perRow * spacing + 6} h={5} c="#141016" />
      ))}

      {floor.map((u, i) => {
        const row = i < perRow ? 0 : 1;
        const col = row === 0 ? i : i - perRow;
        const x = Math.round(startX + col * spacing);
        const y = ROW_Y[row];
        const machine = getMachine(u.machineId);
        const occupied = u.takenBy !== 'NONE';
        // 打たれている台はたまにランプが光っている（雰囲気のみ）
        const lamp = occupied && seeded(seed, u.unitNo) < 0.25;
        const selectable = interactive && !occupied;
        const isHighlighted = highlighted === u.unitNo;

        return (
          <g
            key={u.unitNo}
            onMouseEnter={() => onHover?.(u.unitNo)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => selectable && onSelect?.(u.unitNo)}
            style={{ cursor: selectable ? 'pointer' : 'default' }}
          >
            <Sprite x={x} y={y} rows={CABINET} palette={cabinetPalette(machine.type, lamp)} />
            <text x={x + MACHINE_W / 2} y={y + 3.2} textAnchor="middle" fontFamily="DotGothic16, monospace" fontSize={3.4} fill="#fbbf24">
              {u.unitNo}
            </text>
            {occupied && (
              <Sprite
                x={x + 3}
                y={y + 18}
                rows={SEATED_PERSON}
                palette={{
                  h: '#121110',
                  s: '#a07a62',
                  c: u.takenBy === 'PLAYER' ? '#d9a84a' : COAT_COLORS[u.unitNo % COAT_COLORS.length],
                }}
              />
            )}
            {isHighlighted && (
              <rect x={x - 1} y={y - 1} width={MACHINE_W + 2} height={31} fill="none" stroke="#fbbf24" strokeWidth={0.8} />
            )}
            {/* 当たり判定は台より少し大きく */}
            <rect x={x - 1} y={y - 1} width={spacing} height={32} fill="transparent" />
          </g>
        );
      })}
    </PixelCanvas>
  );
}
