// Moved from the design's history-screens.tsx Empty: the live empty and connect-wallet states.
import * as React from 'react';
import ActionButton from '@/components/ui/action-button';

/** `size`: the picture's box in px (it keeps its own shape inside). */
export function Empty({ img, size = 100, title, text, action, onAction }: { img: string; size?: number; title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div className="m-auto flex h-full max-w-[420px] animate-fade flex-col items-center justify-center gap-y-5 px-6 py-6 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" width={size} height={size} className="object-contain" />
      <p className="text-xl font-semibold">{title}</p>
      <p className="text-sm leading-6 text-secondary">{text}</p>
      <div className="w-full max-w-[260px] transition-transform duration-100 active:scale-[0.98]"><ActionButton isDisabled={false} onClick={onAction}>{action}</ActionButton></div>
    </div>
  );
}
