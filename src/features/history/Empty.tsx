// Moved from the design's history-screens.tsx Empty: the live empty and connect-wallet states.
import * as React from 'react';
import ActionButton from '@/components/ui/action-button';

export function Empty({ img, title, text, action, onAction }: { img: string; title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div className="m-auto flex h-full max-w-[420px] animate-fade flex-col items-center justify-center gap-y-5 px-6 py-6 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" width={img.endsWith('svg') ? 180 : 100} height={img.endsWith('svg') ? 180 : 100} />
      <p className="text-xl font-bold">{title}</p>
      <p className="text-sm leading-6 text-[#898989]">{text}</p>
      <div className="w-full max-w-[260px] transition-transform duration-150 active:scale-[0.98]"><ActionButton isDisabled={false} onClick={onAction}>{action}</ActionButton></div>
    </div>
  );
}
