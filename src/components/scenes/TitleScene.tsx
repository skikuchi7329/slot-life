import { seeded } from '../../utils/math';
import { PixelCanvas, Px, Sprite } from '../game/Pixel';
import { QUEUE_PERSON } from '../game/sprites';

/** 雨の夜、閉店後のホール前に立つ男 */
export function TitleScene() {
  return (
    <PixelCanvas className="scene-fade">
      <Px x={0} y={0} w={320} h={180} c="#07070d" />
      {/* 遠景のビル */}
      {[
        [0, 40, 40],
        [36, 56, 30],
        [70, 30, 44],
        [230, 44, 38],
        [266, 26, 54],
      ].map(([x, y, w]) => (
        <Px key={x} x={x} y={y} w={w} h={140} c="#0d0d16" />
      ))}
      {Array.from({ length: 24 }, (_, i) => (
        <Px key={i} x={Math.floor(seeded('title', i) * 320)} y={40 + Math.floor(seeded('title', i + 99) * 70)} w={2} h={2} c="#c99a4a" o={0.5} />
      ))}
      {/* ホール */}
      <Px x={110} y={60} w={110} h={86} c="#1a1724" />
      <Px x={118} y={66} w={94} h={16} c="#0a0a0a" />
      <Px x={140} y={100} w={50} h={46} c="#2d2f36" />
      {Array.from({ length: 11 }, (_, i) => (
        <Px key={i} x={140} y={102 + i * 4} w={50} h={1} c="#23252b" />
      ))}
      {/* 地面と水たまり */}
      <Px x={0} y={146} w={320} h={34} c="#131318" />
      <Px x={120} y={150} w={90} h={2} c="#e46aa0" o={0.25} />
      <Px x={140} y={156} w={50} h={1} c="#e46aa0" o={0.15} />
      {/* 立ち尽くす男 */}
      <Sprite x={96} y={134} rows={QUEUE_PERSON} palette={{ h: '#0c0c0c', s: '#8a6d58', c: '#2a2c33', l: '#141418' }} scale={1.3} />
      {/* 雨 */}
      {Array.from({ length: 70 }, (_, i) => (
        <Px key={`r${i}`} x={Math.floor(seeded('rain', i) * 320)} y={Math.floor(seeded('rain', i + 300) * 170)} w={1} h={5} c="#5a6684" o={0.55} />
      ))}
    </PixelCanvas>
  );
}
