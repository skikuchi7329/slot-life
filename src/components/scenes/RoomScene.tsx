import { seeded } from '../../utils/math';
import { PixelCanvas, Px, Sprite } from '../game/Pixel';
import { HERO_BACK, HERO_PALETTE } from '../game/sprites';

interface Props {
  time: 'morning' | 'night';
  /** PCの画面が点いているか */
  pcOn: boolean;
  /** 天気・小物の配置を決める種 */
  seed: string;
  /** 精神が低いほど部屋が荒れる */
  mental: number;
}

const TRASH_BAG = ['..ww..', '.wwww.', 'wwwwww', 'wwwwww', 'wwwwww', '.wwww.'];

/** 6畳ワンルーム。机に向かう主人公の後ろ姿 */
export function RoomScene({ time, pcOn, seed, mental }: Props) {
  const night = time === 'night';
  const rainy = seeded(seed, 1) < 0.3;
  const trash = Math.min(6, Math.floor((100 - mental) / 15));

  return (
    <PixelCanvas className="scene-fade">
      {/* 壁と床 */}
      <Px x={0} y={0} w={320} h={110} c="#24222c" />
      <Px x={0} y={106} w={320} h={4} c="#1a1820" />
      <Px x={0} y={110} w={320} h={70} c="#3a3029" />
      {[118, 128, 140, 156].map((y) => (
        <Px key={y} x={0} y={y} w={320} h={1} c="#30271f" />
      ))}

      {/* 窓 */}
      <Px x={196} y={22} w={72} h={50} c="#121118" />
      {night ? (
        <>
          <Px x={200} y={26} w={64} h={42} c="#0a0e1c" />
          <Px x={200} y={46} w={64} h={22} c="#0e1428" />
          {!rainy && [204, 219, 241, 256].map((x, i) => <Px key={x} x={x} y={30 + (i % 2) * 6} c="#c8c8d8" />)}
        </>
      ) : (
        <>
          <Px x={200} y={26} w={64} h={14} c="#8292ad" />
          <Px x={200} y={40} w={64} h={14} c="#a9b3c2" />
          <Px x={200} y={54} w={64} h={14} c="#cdbfa8" />
        </>
      )}
      {/* 向かいの雑居ビル */}
      <Px x={202} y={50} w={18} h={18} c={night ? '#07070c' : '#5d6372'} />
      <Px x={236} y={44} w={26} h={24} c={night ? '#090910' : '#6b7080'} />
      {night &&
        [
          [205, 54],
          [213, 58],
          [240, 48],
          [252, 52],
          [246, 60],
        ].map(([x, y]) => <Px key={`${x}-${y}`} x={x} y={y} w={2} h={2} c="#d8a84a" o={0.8} />)}
      {rainy &&
        Array.from({ length: 18 }, (_, i) => (
          <Px key={i} x={201 + Math.floor(seeded(seed, i + 10) * 62)} y={27 + Math.floor(seeded(seed, i + 40) * 36)} w={1} h={4} c="#6b7a99" o={0.7} />
        ))}
      <Px x={231} y={26} w={2} h={42} c="#121118" />
      {/* カーテン */}
      <Px x={186} y={18} w={12} h={58} c="#3f3648" />
      <Px x={266} y={18} w={12} h={58} c="#3f3648" />
      <Px x={186} y={16} w={92} h={3} c="#2a2530" />

      {/* カレンダーと時計 */}
      <Px x={54} y={28} w={24} h={30} c="#d6d2c4" />
      <Px x={54} y={28} w={24} h={5} c="#9b2f2f" />
      {Array.from({ length: 20 }, (_, i) => (
        <Px key={i} x={57 + (i % 5) * 4} y={36 + Math.floor(i / 5) * 5} w={2} h={2} c={i % 5 === 0 ? '#b04040' : '#8a8a8a'} />
      ))}
      <Px x={148} y={20} w={14} h={14} c="#cfc8b8" />
      <Px x={149} y={21} w={12} h={12} c="#efe9dc" />
      <Px x={154} y={23} w={1} h={5} c="#222" />
      <Px x={155} y={27} w={4} h={1} c="#222" />

      {/* 机とCRTモニター */}
      <Px x={120} y={88} w={82} h={4} c="#5a4636" />
      <Px x={124} y={92} w={4} h={20} c="#46362a" />
      <Px x={194} y={92} w={4} h={20} c="#46362a" />
      <Px x={138} y={60} w={38} h={28} c="#b8b1a1" />
      <Px x={142} y={63} w={30} h={20} c={pcOn ? '#cfd8d2' : '#1d1f22'} />
      {pcOn &&
        Array.from({ length: 6 }, (_, i) => (
          <Px key={i} x={143} y={65 + i * 3} w={28} h={1} c={i === 0 ? '#2a4a8a' : '#9aa6a0'} />
        ))}
      <Px x={150} y={88} w={14} h={1} c="#8f897b" />
      {/* 机の上の缶コーヒーとカップ麺 */}
      <Px x={182} y={82} w={3} h={6} c="#7a4a2a" />
      <Px x={187} y={83} w={7} h={5} c="#e8e2d0" />
      <Px x={187} y={83} w={7} h={1} c="#c23a2a" />

      {/* 主人公 */}
      <Px x={148} y={96} w={18} h={16} c="#26262e" />
      <Sprite x={151} y={74} rows={HERO_BACK} palette={HERO_PALETTE} />

      {/* 布団 */}
      <Px x={12} y={112} w={80} h={14} c="#7d8296" />
      <Px x={14} y={110} w={16} h={8} c="#cfd0d8" />
      <Px x={36} y={110} w={52} h={6} c="#646a80" />

      {/* 冷蔵庫 */}
      <Px x={284} y={82} w={28} h={30} c="#c3c7cc" />
      <Px x={284} y={94} w={28} h={1} c="#8a8e94" />
      <Px x={306} y={86} w={2} h={6} c="#8a8e94" />

      {/* ゴミ袋 */}
      {Array.from({ length: trash }, (_, i) => (
        <Sprite
          key={i}
          x={226 + (i % 3) * 8 + (i >= 3 ? 4 : 0)}
          y={i >= 3 ? 100 : 106}
          rows={TRASH_BAG}
          palette={{ w: '#d6d9dc' }}
        />
      ))}

      {/* 光 */}
      {night ? (
        <>
          <rect x={0} y={0} width={320} height={180} fill="#000014" opacity={0.5} />
          <ellipse cx={157} cy={78} rx={70} ry={45} fill={pcOn ? '#9fd0c0' : '#000'} opacity={pcOn ? 0.1 : 0} />
        </>
      ) : (
        <polygon points="200,68 264,68 300,130 170,130" fill="#fff2d6" opacity={0.06} />
      )}
    </PixelCanvas>
  );
}
