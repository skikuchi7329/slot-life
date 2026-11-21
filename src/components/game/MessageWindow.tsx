import { useEffect, useState } from 'react';
import { useTypewriter } from '../../hooks/useTypewriter';
import { useUiStore } from '../../stores/useUiStore';
import { cn } from '../../utils/cn';

export interface Choice {
  label: string;
  /** 右側に小さく出す補足（費用・効果など） */
  sub?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface Props {
  speaker?: string;
  text: string;
  choices?: Choice[];
}

/**
 * 画面下部の会話ウィンドウ＋右上の選択肢ボックス。
 * 文字送り中は クリック / Enter / Space で全文表示。表示後は ↑↓ と Enter、または数字キーで選ぶ。
 */
export function MessageWindow(props: Props) {
  // text が変わるたびに文字送りをやり直す
  return <MessageWindowInner key={`${props.speaker ?? ''}:${props.text}`} {...props} />;
}

function MessageWindowInner({ speaker, text, choices = [] }: Props) {
  const { shown, done, skip } = useTypewriter(text);
  const [cursor, setCursor] = useState(() => Math.max(0, choices.findIndex((c) => !c.disabled)));
  const pcOpen = useUiStore((s) => s.pcTab !== null);

  useEffect(() => {
    if (pcOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!done) {
        if (['Enter', ' ', 'z'].includes(e.key)) {
          e.preventDefault();
          skip();
        }
        return;
      }
      if (choices.length === 0) return;
      const step = (dir: number) => {
        setCursor((c) => {
          let n = c;
          for (let i = 0; i < choices.length; i++) {
            n = (n + dir + choices.length) % choices.length;
            if (!choices[n].disabled) return n;
          }
          return c;
        });
      };
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        step(-1);
      } else if (['Enter', ' ', 'z'].includes(e.key)) {
        e.preventDefault();
        const c = choices[cursor];
        if (c && !c.disabled) c.onSelect();
      } else if (/^[1-9]$/.test(e.key)) {
        const c = choices[Number(e.key) - 1];
        if (c && !c.disabled) c.onSelect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, skip, choices, cursor, pcOpen]);

  if (pcOpen) return null;

  return (
    <>
      {done && choices.length > 0 && (
        <div className="game-window absolute right-6 bottom-[206px] z-20 min-w-[420px] max-w-[620px] px-2 py-2">
          <ul>
            {choices.map((c, i) => (
              <li key={c.label}>
                <button
                  type="button"
                  disabled={c.disabled}
                  onMouseEnter={() => !c.disabled && setCursor(i)}
                  onClick={() => !c.disabled && c.onSelect()}
                  className={cn(
                    'flex w-full items-baseline gap-3 px-3 py-1.5 text-left text-[22px] leading-tight',
                    c.disabled ? 'text-neutral-600' : 'text-neutral-100',
                    i === cursor && !c.disabled && 'bg-white/10',
                  )}
                >
                  <span className={cn('w-5 shrink-0 text-amber-300', i === cursor && !c.disabled ? 'blink' : 'invisible')}>▶</span>
                  <span className="flex-1">{c.label}</span>
                  {c.sub && <span className="shrink-0 text-[15px] text-neutral-400">{c.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="absolute right-6 bottom-5 left-6 z-20 h-[176px]" onClick={() => !done && skip()}>
        {speaker && (
          <div className="game-window absolute -top-[30px] left-6 px-4 py-0.5 text-[20px] text-amber-200">{speaker}</div>
        )}
        <div className="game-window h-full px-8 pt-6 pb-4">
          <p className={cn('leading-[1.6] whitespace-pre-wrap text-neutral-100', text.length > 90 ? 'text-[21px]' : 'text-[25px]')}>
            {shown}
            {done && choices.length === 0 && <span className="blink ml-1 text-amber-300">▼</span>}
          </p>
        </div>
      </div>
    </>
  );
}
