'use client';
// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
// The button really copies `text`; the check shows once the browser took it. Motion (approved 2026-10-29): the copy icon
// turns into a green check for one second (MS.copied); the icon coming in fades and grows from 0.6 (150 ms).
import * as React from 'react';
import { motion } from 'motion/react';
import { CheckIcon, CopyIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { MS, T, tw, useMounted } from '@/lib/motion';

/** Which copy button shows its check (for one second, MS.copied). */
export function useCopied(): [string | null, (key: string) => void] {
  const [copied, setCopied] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const copy = (key: string) => { setCopied(key); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(null), MS.copied); };
  return [copied, copy];
}

export function CopyButton({ id, copied, onCopy, text }: { id: string; copied: string | null; onCopy: (k: string) => void; text: string }) {
  const on = copied === id;
  const mounted = useMounted();
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(text).then(() => onCopy(id), () => {});
      }}
      className={cn('cursor-pointer rounded-xl p-0.5 hover:bg-white/10', tw.quick, tw.pressIcon)}
    >
      <motion.span key={on ? 'check' : 'copy'} className="flex" initial={mounted ? { opacity: 0, scale: 0.6 } : false} animate={{ opacity: 1, scale: 1 }} transition={T.hover}>
        {on ? <CheckIcon width={16} height={16} className="text-success" /> : <CopyIcon width={16} height={16} />}
      </motion.span>
    </span>
  );
}
