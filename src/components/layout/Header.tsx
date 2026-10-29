'use client';
import Link from 'next/link';
import { useWallets } from '@/lib/wallets';
import { cn } from '@/lib/cn';
import { WalletMenuButton } from './WalletMenu';

/**
 * The live header: logo left, the wallet pill right (platform-v2 _layout/header.tsx and wallet.tsx:113-147).
 * The pill opens the wallet menu (design wallet-screens.tsx): its label and the connected wallets' logos.
 */
export default function Header() {
  const { evm, icp } = useWallets();
  const both = !!evm && !!icp;
  const pill = (
    <button
      type="button"
      className={cn(
        'relative flex min-w-fit items-center justify-evenly gap-2 lg:h-[42px]',
        'rounded-full border border-[#ECE6F5] bg-[#faf7fd]/50 md:col-span-2 md:justify-self-end',
        (evm || icp) && 'px-3',
        '*:rounded-full',
      )}
    >
      <span className="w-full whitespace-nowrap px-3 py-2 text-sm font-medium text-white">
        {both ? 'Connected Wallets' : evm || icp ? 'Add Wallet' : 'Connect Wallet'}
      </span>
      {(icp || evm) && (
        <span className="flex items-center gap-x-2">
          {icp && <img src="/images/logo/wallet_logos/icp.svg" alt="" width={24} height={24} className="min-h-6 min-w-6" />}
          {evm && <img src="/images/logo/chains-logos/ethereum.svg" alt="" width={24} height={24} className="min-h-6 min-w-6" />}
        </span>
      )}
    </button>
  );
  return (
    <header className="mb-5 flex w-full items-center justify-between xl:mt-4">
      <Link href="/" className="relative h-[34px] w-[42px] md:h-[42px] md:w-[52px]">
        <img src="/images/landing/logo/swapic-logo.svg" alt="Swapic" className="absolute inset-0 h-full w-full" />
      </Link>
      <WalletMenuButton trigger={pill} />
    </header>
  );
}
