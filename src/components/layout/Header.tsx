'use client';
import Link from 'next/link';
import { useWallets } from '@/lib/wallets';
import { cn } from '@/lib/cn';
import { ConnectMenu, WalletPill } from './ConnectMenu';

/** The live header: logo left, the wallet pill right (platform-v2 _layout/header.tsx and wallet.tsx:113-147). */
export default function Header() {
  const { evm, icp } = useWallets();
  const both = !!evm && !!icp;
  return (
    <header className="mb-5 flex w-full items-center justify-between xl:mt-4">
      <Link href="/" className="relative h-[34px] w-[42px] md:h-[42px] md:w-[52px]">
        <img src="/images/landing/logo/swapic-logo.svg" alt="Swapic" className="absolute inset-0 h-full w-full" />
      </Link>
      <div
        className={cn(
          'relative flex min-w-fit items-center justify-evenly gap-2 lg:h-[42px]',
          'rounded-full border border-[#ECE6F5] bg-[#faf7fd]/50 md:col-span-2 md:justify-self-end',
          (evm || icp) && 'px-3',
          '*:rounded-full',
        )}
      >
        {!both && <ConnectMenu />}
        {both && <span className="w-full px-3 py-2 text-sm font-medium text-white">Connected Wallets</span>}
        <div className="flex items-center gap-x-2">
          {icp && <WalletPill side="icp" logo="/images/logo/wallet_logos/icp.svg" address={icp.principal} />}
          {evm && <WalletPill side="evm" logo="/images/logo/chains-logos/ethereum.svg" address={evm.address} />}
        </div>
      </div>
    </header>
  );
}
