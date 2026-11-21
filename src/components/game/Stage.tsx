import { useEffect, useState, type ReactNode } from 'react';

export const STAGE_W = 1280;
export const STAGE_H = 720;

function fitScale() {
  return Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
}

/** 1280×720 の固定解像度ステージ。ウィンドウに合わせて等倍拡縮し、余白は黒帯にする */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(fitScale);

  useEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
        <div
          className="relative overflow-hidden bg-neutral-950"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
