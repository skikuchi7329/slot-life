import { useEffect, useState } from 'react';

/**
 * 1文字ずつ表示する。text が変わったら呼び出し側で key を変えて再マウントすること。
 */
export function useTypewriter(text: string, msPerChar = 28) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, msPerChar]);

  return {
    shown: text.slice(0, count),
    done: count >= text.length,
    skip: () => setCount(text.length),
  };
}
