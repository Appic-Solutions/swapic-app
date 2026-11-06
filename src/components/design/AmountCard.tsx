// Amount card: the live AmountInput (src/app/(panel)/bridge/_components/
// select-token/AmountInput.tsx) markup driven by props instead of the app
// stores, plus a skeleton for the max button and balance while the wallet
// balance loads. Moved from the design's AmountCard.tsx (sha 417010756cd3): the
// caller formats every number with @/lib/money and passes the texts in.
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
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
}

export default function AmountCard({ token, amountText, onAmountText, usdText, balanceText, onMax, balanceLoading, message, label = 'Send', disabled }: AmountCardProps) {
  return (
    // With a message the card grows to fit it: the design's message sat absolutely under the dollar line, sized for one
    // short line, so a longer one (the cap's) wrapped onto the dollar line (Jeff's screenshot, 2026-10-31).
    <Card className={'mt-3 cursor-auto flex-col items-start justify-center gap-2 p-4 first:mt-0 md:mt-4 md:p-5 md:first:mt-0' + (message ? '' : ' max-h-[133px] md:max-h-[155px]')}>
      <p className="text-xs font-medium text-secondary md:text-sm">{label}</p>
      <div className="flex w-full items-center gap-3 md:gap-4">
        <div className="relative">
          <Avatar src={token.logo} className="h-9 w-9 md:h-12 md:w-12" />
          <Avatar src={token.chainLogo} className={'absolute -bottom-1 -right-1 h-4 w-4 ring-2 ring-[#18181a] md:h-5 md:w-5' + (token.chainLogo === SWAPIC_LOGO ? ' bg-black p-0.5' : '')} />
        </div>
        <div className="relative flex w-full flex-col">
          <div className="flex w-full items-center">
            <input
              // type text, not number: a number box writes the phone's own decimal mark (0,01 beside $805.39); a typed comma becomes a dot
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amountText}
              disabled={disabled}
              onKeyDown={(e) => { if (NOT_AMOUNT_KEYS.has(e.key)) e.preventDefault(); }}
              onChange={(e) => { const t = e.target.value.replace(',', '.'); if (t.length <= 15 && isAmountText(t)) onAmountText?.(t); }}
              className="w-full bg-transparent py-1 text-primary outline-none placeholder:text-faint"
            />
            {balanceLoading ? (
              <Skeleton className="ml-3 h-6 w-[46px] shrink-0" />
            ) : (
              balanceText !== undefined && (
                <span
                  onClick={() => onMax?.()}
                  className={'ml-3 cursor-pointer rounded-full bg-white/[0.08] px-3 py-1 text-xs font-medium text-white hover:bg-white/[0.14] ' + tw.quick + ' ' + tw.press}
                >
                  max
                </span>
              )
            )}
          </div>
          <div className="flex w-full items-center justify-between">
            <p className="text-xs font-normal text-secondary md:text-sm">{usdText ?? ''}</p>
            {balanceLoading ? (
              <SkeletonText className="w-16 text-xs md:text-sm" />
            ) : (
              balanceText !== undefined && <p className="text-nowrap text-center text-xs font-normal text-secondary md:text-sm">{balanceText}</p>
            )}
          </div>
          {message && <p className="mt-1 animate-slide-in-from-top text-xs font-normal text-warn">{message}</p>}
        </div>
      </div>
    </Card>
  );
}
