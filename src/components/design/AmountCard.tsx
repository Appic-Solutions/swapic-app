// Amount card: the live AmountInput (src/app/(panel)/bridge/_components/
// select-token/AmountInput.tsx) markup driven by props instead of the app
// stores, plus a skeleton for the max button and balance while the wallet
// balance loads (it shimmers, motion tw.shimmer). Moved from the design's AmountCard.tsx (sha 417010756cd3): the
// caller formats every number with @/lib/money and passes the texts in.
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import Skeleton from '@/components/ui/skeleton';
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
  /** Name for an in place change: a card with the same data-fly name in the leaving view flies into this one. */
  fly?: string;
  /** The amount cannot be typed yet (Withdraw while the stake loads). */
  disabled?: boolean;
}

export default function AmountCard({ token, amountText, onAmountText, usdText, balanceText, onMax, balanceLoading, message, label = 'Send', fly, disabled }: AmountCardProps) {
  return (
    // With a message the card grows to fit it: the design's message sat absolutely under the dollar line, sized for one
    // short line, so a longer one (the cap's) wrapped onto the dollar line (Jeff's screenshot, 2026-10-31).
    <Card data-fly={fly} data-fly-fit={fly ? 'width' : undefined} className={'mt-4 cursor-auto flex-col items-start justify-center gap-2 py-5 hover:bg-[#000000]/0 md:rounded-3xl md:px-6 md:py-5' + (message ? '' : ' max-h-[133px] md:max-h-[155px]')}>
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex w-full items-start gap-4">
        <div className="relative">
          <Avatar src={token.logo} className="h-12 w-12" />
          <Avatar src={token.chainLogo} className={'absolute -bottom-1 -right-1 h-5 w-5 shadow-[0_0_3px_0_rgba(255,255,255,0.5)]' + (token.chainLogo === SWAPIC_LOGO ? ' bg-black p-0.5' : '')} />
        </div>
        <div className="relative flex w-full flex-col">
          <div className="flex w-full items-center">
            <input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="0"
              value={amountText}
              disabled={disabled}
              onKeyDown={(e) => { if (NOT_AMOUNT_KEYS.has(e.key)) e.preventDefault(); }}
              onChange={(e) => { if (e.target.value.length <= 15 && isAmountText(e.target.value)) onAmountText?.(e.target.value); }}
              className="w-full rounded-md border-[#000000] bg-transparent py-2 text-primary outline-none placeholder:text-primary/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {balanceLoading ? (
              <Skeleton className={'ml-3 h-7 w-14 rounded-md ' + tw.shimmer} />
            ) : (
              balanceText !== undefined && (
                <span
                  onClick={() => onMax?.()}
                  className={'ml-3 cursor-pointer rounded-md bg-gradient-to-r from-white to-white/35 px-4 py-1 text-xs text-black hover:bg-white/35 md:text-sm ' + tw.quick + ' ' + tw.press}
                >
                  max
                </span>
              )
            )}
          </div>
          <div className="flex w-full items-center justify-between">
            <p className="text-sm">{usdText ?? ''}</p>
            {balanceLoading ? (
              <Skeleton className={'h-4 w-16 ' + tw.shimmer} />
            ) : (
              balanceText !== undefined && <p className="text-nowrap text-center text-xs font-semibold text-muted md:text-sm">{balanceText}</p>
            )}
          </div>
          {message && <p className="mt-1 animate-slide-in-from-top text-xs text-yellow-600">{message}</p>}
        </div>
      </div>
    </Card>
  );
}
