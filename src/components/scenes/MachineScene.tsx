import type { MachineType } from '../../types';
import { PixelCanvas, Px, Sprite } from '../game/Pixel';
import { cabinetPalette, CABINET, COAT_COLORS, SEATED_PERSON } from '../game/sprites';

interface Props {
  type: MachineType;
  neighborTypes: [MachineType, MachineType];
  lampOn: boolean;
}

// データカウンター部（先頭4行）はHTMLで重ねるので筐体だけ描く
const BODY = CABINET.slice(4);
const SCALE = 4;

/** 着席した台のアップ。両隣には知らない誰か */
export function MachineScene({ type, neighborTypes, lampOn }: Props) {
  return (
    <PixelCanvas className="scene-fade">
      <Px x={0} y={0} w={320} h={180} c="#1c1420" />
      <Px x={0} y={0} w={320} h={14} c="#0e0b12" />
      <Px x={0} y={136} w={320} h={44} c="#2a1b2c" />

      {/* 隣の台と客 */}
      {[60, 204].map((x, i) => (
        <g key={x} opacity={0.45}>
          <Sprite x={x} y={36} rows={BODY} palette={cabinetPalette(neighborTypes[i], false)} scale={SCALE} />
          <Sprite x={x + 12} y={92} rows={SEATED_PERSON} palette={{ h: '#0c0b0a', s: '#806250', c: COAT_COLORS[i + 2] }} scale={SCALE} />
        </g>
      ))}

      {/* 自分の台 */}
      <Sprite x={132} y={36} rows={BODY} palette={cabinetPalette(type, lampOn)} scale={SCALE} />
      {lampOn && <circle className="lamp" cx={145} cy={78} r={9} fill="#ff3d6e" opacity={0.35} />}
      {/* データカウンターの支柱 */}
      <Px x={158} y={30} w={4} h={6} c="#0a0a0a" />
    </PixelCanvas>
  );
}
