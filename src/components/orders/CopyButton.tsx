// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
// The button now really copies `text`; the check shows once the browser took it.
'use client';
import * as React from 'react';
import { CheckIcon, CopyIcon } from '@/components/icons';

export function useCopied(): [string | null, (key: string) => void] {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = (key: string) => { setCopied(key); setTimeout(() => setCopied(null), 1200); };
  return [copied, copy];
}

export function CopyButton({ id, copied, onCopy, text }: { id: string; copied: string | null; onCopy: (k: string) => void; text: string }) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(text).then(() => onCopy(id), () => {});
      }}
      className="cursor-pointer rounded-md p-0.5 transition-colors hover:bg-white/10 active:scale-90"
    >
      {copied === id ? <CheckIcon width={16} height={16} className="text-[#12b76a]" /> : <CopyIcon width={16} height={16} />}
    </span>
  );
}
