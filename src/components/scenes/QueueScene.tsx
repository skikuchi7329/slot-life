import { seeded } from '../../utils/math';
import { PixelCanvas, Px, Sprite } from '../game/Pixel';
import { COAT_COLORS, QUEUE_PERSON } from '../game/sprites';

interface Props {
  parlorName: string;
  queueSize: number;
  eventDay: boolean;
  seed: string;
}

/** 開店前のホール。シャッターの前に並ぶ人の列 */
export function QueueScene({ parlorName, queueSize, eventDay, seed }: Props) {
  const shown = Math.min(queueSize, 84);
  const perRow = 42;
  const heroIndex = Math.floor(seeded(seed, 7) * Math.min(shown, perRow));

  return (
    <PixelCanvas className="scene-fade">
      {/* 朝の空 */}
      <Px x={0} y={0} w={320} h={30} c="#8b97ad" />
      <Px x={0} y={30} w={320} h={20} c="#a8b0bd" />
      {/* 建物 */}
      <Px x={20} y={18} w={280} h={92} c="#2e2a38" />
      <Px x={20} y={18} w={280} h={3} c="#1e1b26" />
      <Px x={60} y={24} w={200} h={24} c="#0b0b0f" />
      <text
        x={160}
        y={41}
        textAnchor="middle"
        fontFamily="DotGothic16, monospace"
        fontSize={11}
        fill={eventDay ? '#ffd166' : '#ff6fae'}
        style={{ filter: `drop-shadow(0 0 2px ${eventDay ? '#ffb000' : '#ff3d8b'})` }}
      >
        {parlorName}
      </text>
      {/* のぼり（イベント日は赤） */}
      {[34, 278].map((x) => (
        <g key={x}>
          <Px x={x} y={50} w={1} h={60} c="#777" />
          <Px x={x + 1} y={52} w={7} h={30} c={eventDay ? '#c0262d' : '#3b5a9a'} />
        </g>
      ))}
      {/* シャッター */}
      <Px x={100} y={58} w={120} h={52} c="#5a5e66" />
      {Array.from({ length: 13 }, (_, i) => (
        <Px key={i} x={100} y={60 + i * 4} w={120} h={1} c="#4a4d54" />
      ))}
      <text x={160} y={70} textAnchor="middle" fontFamily="DotGothic16, monospace" fontSize={5} fill="#d8d8d8">
        AM 10:00 OPEN
      </text>
      {/* 歩道 */}
      <Px x={0} y={110} w={320} h={70} c="#4a4a52" />
      {Array.from({ length: 16 }, (_, i) => (
        <Px key={i} x={i * 20} y={110} w={1} h={70} c="#424249" />
      ))}

      {/* 並び（後列 → 前列の順に描く） */}
      {Array.from({ length: shown }, (_, i) => {
        const row = i < perRow ? 0 : 1;
        const col = i % perRow;
        const x = 6 + col * 7.4;
        const y = row === 0 ? 112 : 104;
        const isHero = row === 0 && col === heroIndex;
        return (
          <Sprite
            key={i}
            x={Math.round(x)}
            y={y}
            rows={QUEUE_PERSON}
            palette={{
              h: '#141210',
              s: '#a8826a',
              c: isHero ? '#d9a84a' : COAT_COLORS[Math.floor(seeded(seed, i + 20) * COAT_COLORS.length)],
              l: '#1d1d22',
            }}
          />
        );
      }).reverse()}
    </PixelCanvas>
  );
}
