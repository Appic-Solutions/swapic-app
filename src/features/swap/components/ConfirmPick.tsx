'use client';
// Before a fake or an unverified token can be picked (the approved calm design, design-sync verified-tokens.tsx): a quiet
// dark card saying what it is in plain words and a box to tick; a fake's first button picks the real token instead.
import * as React from 'react';
import ActionButton from '@/components/ui/action-button';
import { MarkAfterSymbol } from '@/components/ui/token-marks';
import type { UiToken } from '@/components/ui/token-types';
import { listedFor, markOf, needsConfirm } from '@/lib/token-marks';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';

export function ConfirmPick({ token, mark, realSymbol, onCancel, onConfirm, onReal }: {
  token: UiToken; mark: 'fake' | 'unverified';
  /** A fake: the symbol of the listed token it imitates. */
  realSymbol?: string;
  onCancel: () => void; onConfirm: () => void;
  /** A fake: picks the real token instead. */
  onReal?: () => void;
}) {
  const [ok, setOk] = React.useState(false);
  const fake = mark === 'fake';
  const real = realSymbol ?? token.symbol;
  // a letter from another alphabet that looks like a Latin one
  const otherAlphabet = /[^\x00-\x7F]/.test(token.symbol + token.name);
  return (
    <div className="mt-2 flex flex-col gap-y-3 rounded-2xl bg-[#1B1B1B] p-4 text-sm text-white ring-1 ring-white/[0.08]">
      <div className="flex items-start gap-x-3">
        <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold', fake ? 'bg-red-400/10 text-red-300' : 'bg-amber-300/10 text-amber-200')}>
          {fake ? '!' : '?'}
        </span>
        <div className="flex min-w-0 flex-col gap-y-1">
          <p className="text-[15px] font-semibold">{fake ? `This is not the real ${real}` : "Not on Swapic's trusted list"}</p>
          <p className="leading-snug text-[#9C9C9C]">
            {fake
              ? otherAlphabet ? `One letter in its name is from another alphabet, so it only looks like ${real}.` : `It is named ${real}, but it is a different token on ${token.chainName}.`
              : 'Anyone can make a token. Check the address with the project first.'}
          </p>
          {!fake && <p className="mt-1 w-fit rounded-lg bg-white/[0.05] px-2 py-1 font-mono text-xs text-[#C8C8C8]">{short(token.address)}</p>}
        </div>
      </div>
      {fake && onReal && (
        <div className={cn(tw.quick, tw.press)}>
          <ActionButton isDisabled={false} onClick={onReal}>{`Use the real ${real}`}</ActionButton>
        </div>
      )}
      <label className="flex cursor-pointer items-center gap-x-2.5 text-[13px] text-[#C8C8C8]">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="h-4 w-4 cursor-pointer accent-blue-500" />
        {fake ? `I know it is not the real ${real}` : 'I understand it is not verified'}
      </label>
      <div className="flex items-center justify-end gap-x-2">
        <button type="button" onClick={onCancel} className={cn('h-10 rounded-xl px-4 text-[#C8C8C8] hover:bg-white/[0.06]', tw.quick, tw.press)}>Cancel</button>
        {fake ? (
          <button
            type="button"
            disabled={!ok}
            onClick={ok ? onConfirm : undefined}
            className={cn('h-10 rounded-xl px-4 font-semibold', ok ? 'bg-white/[0.08] text-white hover:bg-white/[0.12]' : 'cursor-not-allowed text-white/30', tw.quick, ok && tw.press)}
          >
            Pick it anyway
          </button>
        ) : (
          <div className={cn('w-40', tw.quick, tw.press)}>
            <ActionButton isDisabled={!ok} onClick={ok ? onConfirm : undefined}>Use this token</ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}

/** One slim line before signing: what to check about a flagged token, no loud block. */
function SlimNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-x-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 text-[13px] leading-snug text-[#B0B0B0]">
      <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-amber-200/80" />
      <span>{children}</span>
    </div>
  );
}

/** Review swap's marks: each token's mark after its amount, and the line to check a flagged token by (the To token first). */
export function reviewMarks(from: UiToken, to: UiToken): { pay: React.ReactNode; get: React.ReactNode; check: React.ReactNode } {
  const mark = (t: UiToken) => <MarkAfterSymbol mark={markOf(t)} symbol={t.symbol} chainName={t.chainName} />;
  const flagged = [to, from].find((t) => needsConfirm(markOf(t)));
  const what = (t: UiToken) => (markOf(t) === 'fake' ? `${t.symbol} is not the real ${listedFor(t)?.token.symbol ?? t.symbol}.` : `${t.symbol} is not on Swapic's trusted list.`);
  return {
    pay: mark(from),
    get: mark(to),
    check: flagged ? (
      <SlimNote>
        {what(flagged)} Check that <span className="font-mono text-[#D0D0D0]">{short(flagged.address)}</span> is the token you want before you sign.
      </SlimNote>
    ) : null,
  };
}
