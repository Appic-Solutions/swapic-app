'use client';
import Link from 'next/link';
import { useWallets } from '@/lib/wallets';
import { cn } from '@/lib/cn';
import { WalletIcon } from '@/components/icons';
import { WalletMenuButton } from './WalletMenu';

/**
 * The live header: logo left, the wallet pill right (platform-v2 _layout/header.tsx and wallet.tsx:113-147).
 * The pill opens the wallet menu (design wallet-screens.tsx): its label and the connected wallets' logos.
 */
export default function Header() {
  const { evm, icp } = useWallets();
  const both = !!evm && !!icp;
  const label = both ? 'Connected Wallets' : evm || icp ? 'Add Wallet' : 'Connect Wallet';
  const pill = (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.06] px-2.5 text-sm font-medium text-white md:px-4',
        // the approved motion: brighter on hover, sinks a little when pressed
        'transition duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/10 active:scale-[0.97] motion-reduce:active:scale-100',
      )}
    >
      {!evm && !icp && <WalletIcon width={20} height={20} className="md:hidden" />}
      <span className="whitespace-nowrap max-md:hidden">{label}</span>
      {(icp || evm) && (
        <span className="flex items-center gap-x-1.5">
          {icp && <img src="/images/logo/wallet_logos/icp.svg" alt="" width={20} height={20} className="h-5 w-5 rounded-full" />}
          {evm && <img src="/images/logo/chains-logos/ethereum.svg" alt="" width={20} height={20} className="h-5 w-5 rounded-full" />}
        </span>
      )}
    </button>
  );
  return (
    <header className="mb-4 flex w-full items-center justify-between md:mb-5 xl:h-[54px] md:short:mb-4 md:tiny:mb-3 lg:short:h-[46px] xl:short:h-[46px]">
      <Link href="/" className="relative h-[34px] w-[42px] md:h-[42px] md:w-[52px] md:short:h-[34px] md:short:w-[42px]">
        <img src="/images/landing/logo/swapic-logo.svg" alt="Swapic" className="absolute inset-0 h-full w-full" />
      </Link>
      <WalletMenuButton trigger={pill} />
    </header>
  );
}
