/** 今日の告知・匂わせ（スマホの画面・店内のポスター風） */
export function NoticeCard({ medium, text }: { medium: string; text: string }) {
  return (
    <div className="game-window absolute top-[76px] right-6 z-10 w-[420px] px-4 py-2">
      <div className="text-[14px] text-neutral-400">今日の{medium}</div>
      <div className="text-[19px] text-amber-100">{text}</div>
    </div>
  );
}
