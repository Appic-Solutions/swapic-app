// Amount card: the live AmountInput (src/app/(panel)/bridge/_components/
// select-token/AmountInput.tsx) markup driven by props instead of the app
// stores, plus a skeleton for the max button and balance while the wallet
// balance loads. Moved from the design's AmountCard.tsx (sha 417010756cd3): the
// caller formats every number with @/lib/money and passes the texts in.
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { SkeletonText } from '@/components/ui/skeleton';
import { SWAPIC_LOGO } from './swapic-logo';
import { tw } from '@/lib/motion';
import { isAmountText, NOT_AMOUNT_KEYS } from '@/lib/money';

export interface AmountCardProps {
  /** The token sent and its chain's logo (the small badge). */
  token: { logo: string; chainLogo: string };
  amountText: string;
  onAmountText?: (text: string) => void;
  /** Dollar value of the amount, formatted by the caller; null when unknown. */
  usdText: string | null;
  /** Wallet balance of the token, shown with the max button. */
  balanceText?: string;
  onMax?: () => void;
  /** True while the wallet balance loads: skeletons replace max and the balance. */
  balanceLoading?: boolean;
  /** Yellow note under the amount, e.g. when no route exists. */
  message?: string;
  /** Card title (the live card says Send). */
  label?: string;
  /** The amount cannot be typed yet (Withdraw while the stake loads). */
  disabled?: boolean;
  /** Kept for callers: the note now always takes the dollar line's place, so every card keeps one height. */
  reserveMessage?: boolean;
}

export default function AmountCard({ token, amountText, onAmountText, usdText, balanceText, onMax, balanceLoading, message, label = 'Send', disabled }: AmountCardProps) {
  return (
    // Three rows, nothing reserved empty (Jeff 2026-11-09, polish): the label with the balance and Max, then the logo beside
    // the amount, and under the amount one line that holds its dollar value, or the yellow note in its place. The card keeps
    // one height when a note comes and goes; a note longer than the line wraps and the card grows to fit it.
    <Card className="mt-3 cursor-auto flex-col items-stretch gap-3 p-4 first:mt-0 md:mt-4 md:p-5 md:first:mt-0 md:short:mt-3 md:short:gap-2 md:short:py-4 md:tiny:gap-1.5 md:tiny:py-3 md:short:first:mt-0">
      <div className="flex w-full items-center justify-between gap-3 text-xs font-medium md:text-sm">
        <p className="text-secondary">{label}</p>
        {balanceLoading ? (
          <SkeletonText className="w-24 text-xs md:text-sm" />
        ) : (
          balanceText !== undefined && (
            <div className="flex min-w-0 items-center gap-2 font-normal text-secondary">
              <span className="truncate">Balance <span className="text-white">{balanceText}</span></span>
              <button
                type="button"
                onClick={() => onMax?.()}
                disabled={disabled}
                className={'shrink-0 rounded-full bg-white/[0.08] px-2.5 py-0.5 text-xs font-medium text-white hover:bg-white/[0.14] disabled:opacity-40 ' + tw.quick + ' ' + tw.press}
              >
                Max
              </button>
            </div>
          )
        )}
      </div>
      <div className="flex w-full items-center gap-3 md:gap-4">
        <div className="relative shrink-0">
          <Avatar src={token.logo} className="h-9 w-9 md:h-12 md:w-12" />
          <Avatar src={token.chainLogo} className={'absolute -bottom-1 -right-1 h-4 w-4 ring-2 ring-[#18181a] md:h-5 md:w-5' + (token.chainLogo === SWAPIC_LOGO ? ' bg-black p-0.5' : '')} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            // type text, not number: a number box writes the phone's own decimal mark (0,01 beside $805.39); a typed comma becomes a dot
            type="text"
            inputMode="decimal"
            autoComplete="off"
            // words, light and a step under the amount's own size, so the empty card reads calm (Jeff 2026-11-09)
            placeholder="Enter amount"
            value={amountText}
            disabled={disabled}
            onKeyDown={(e) => { if (NOT_AMOUNT_KEYS.has(e.key)) e.preventDefault(); }}
            onChange={(e) => { const t = e.target.value.replace(',', '.'); if (t.length <= 15 && isAmountText(t)) onAmountText?.(t); }}
            className="h-8 w-full bg-transparent text-primary outline-none placeholder:text-lg placeholder:font-normal placeholder:text-faint md:placeholder:text-xl"
          />
          {/* the dollar value, or the note in its place (warm): one line, kept even while empty */}
          <p className="min-h-4 text-xs font-normal leading-4 md:min-h-5 md:text-sm md:leading-5">
            {message ? (
              <span key={message} className="block animate-slide-in-from-top text-warn">{message}</span>
            ) : (
              // nothing typed is worth $0.00, whatever the price: the line never sits blank
              <span className="text-secondary">{usdText ?? (amountText ? '' : '$0.00')}</span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
