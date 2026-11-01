'use client';
// New-design wallet menu: "Connect a wallet" and the connected wallets, in the live connect menu look
// (a Popover under the header's wallet pill on desktop, a Drawer on phones, WalletCard rows, the wallet
// popover's copy and Disconnect). It opens on two choices, EVM wallet and ICP wallet (Jeff, 2026-11-01): EVM opens the
// EVM wallet list (Reown); ICP opens its own step listing OISY, NFID, Internet Identity and Plug, with a way back.
// Plug is offered only when its extension answered at load (lib/wallets/plug.ts); otherwise its row opens Plug's site.
// One EVM and one ICP wallet at once.
// Moved from the design's wallet-screens.tsx (sha 10070b45adc6, approved by Jeff 2026-10-29): Label, Connected,
// Connecting, WalletMenu and Menu. Its mock wallet state became the wallet store plus a local "connecting" mark;
// the copy button really copies; the invisible trigger over the pill became the pill itself (Menu's `trigger`).
import * as React from 'react';
import { getAddress } from 'viem';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTrigger } from '@/components/ui/drawer';
import WalletCard from '@/components/ui/wallet-card';
import { Avatar } from '@/components/ui/avatar';
import Spinner from '@/components/ui/spinner';
import { ChevronDownIcon, CloseIcon, CopyIcon, ExpandLeftIcon } from '@/components/icons';
import {
  PLUG_INSTALL_URL, PLUG_PRESENT, useDisconnectWallets, useEvmConnect, useEvmModalOpen, useIcpConnect, useWallets, type IcpSignerId,
} from '@/lib/wallets';
import { useWalletMenu } from '@/lib/wallets/menu';
import { AnimatePresence, motion } from 'motion/react';
import { menu, tw } from '@/lib/motion';

type IcpWallet = 'OISY' | 'NFID' | 'Internet Identity' | 'Plug';
const ICP_WALLETS: [IcpWallet, string, IcpSignerId][] = [
  ['OISY', '/images/wallets/oisy.svg', 'OISY'],
  ['NFID', '/images/wallets/nfid.svg', 'NFIDW'],
  ['Internet Identity', '/images/wallets/internet-identity.svg', 'InternetIdentity'],
  ['Plug', '/images/wallets/plug.svg', 'Plug'],
];
const EVM_LOGO = '/images/logo/chains-logos/ethereum.svg';
const ICP_LOGO = '/images/logo/wallet_logos/icp.svg';
/** A connected ICP wallet whose signer IdentityKit did not name. */
const UNKNOWN_ICP: [string, string] = ['ICP wallet', ICP_LOGO];
const byName = (w: IcpWallet) => ICP_WALLETS.find(([n]) => n === w)!;
const bySigner = (s: IcpSignerId | null) => ICP_WALLETS.find(([, , id]) => id === s);

export const short = (a: string) => (a.length <= 13 ? a : a.startsWith('0x') ? `${a.slice(0, 6)}…${a.slice(-4)}` : `${a.slice(0, 5)}…${a.slice(-3)}`);

export interface Wallets {
  /** The address, or 'connecting' while the wallet's window is open. */
  evm: null | 'connecting' | string;
  /** No principal yet while the wallet's window is open. */
  icp: null | { name: string; logo: string; principal?: string };
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="px-2 text-sm text-[#919191]">{children}</p>;

// The live WalletCard row with the wallets it opens named under it and an arrow: the two first choices.
function Choice({ logo, name, note, onClick }: { logo: string; name: string; note: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex cursor-pointer items-center gap-2 rounded-md p-2 duration-200 hover:bg-[#2A2A2A]">
      <Avatar src={logo} className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-white">{name}</p>
        <p className="text-xs text-[#898989]">{note}</p>
      </div>
      <ChevronDownIcon width={16} height={16} className="shrink-0 -rotate-90 text-white/60" />
    </div>
  );
}

// Plug when its extension is not in this browser (phones included): the same row, opening Plug's site in a new tab.
function GetPlug({ logo }: { logo: string }) {
  return (
    <a href={PLUG_INSTALL_URL} target="_blank" rel="noopener noreferrer" className="flex cursor-pointer items-center gap-2 rounded-md p-2 duration-200 hover:bg-[#2A2A2A]">
      <Avatar src={logo} className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-white">Plug</p>
        <p className="text-xs text-[#898989]">Not found in this browser. Get it at plugwallet.ooo</p>
      </div>
    </a>
  );
}

// A connected wallet: logo, name, short address with the live copy bubble, Disconnect.
function Connected({ logo, name, address, onDisconnect }: { logo: string; name: string; address: string; onDisconnect?: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(address).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => {},
    );
  };
  return (
    <div className="flex animate-fade items-center gap-3 rounded-md p-2">
      <Avatar src={logo} className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-white">{name}</p>
        <div className="flex items-center gap-x-1.5 text-sm text-white/80">
          <span className="font-mono">{short(address)}</span>
          <button className="relative rounded-md p-0.5 transition-colors hover:bg-white/10 active:scale-90" onClick={copy}>
            <CopyIcon width={16} height={16} />
            {copied && <div className="absolute -left-5 -top-8 animate-fade rounded-lg border border-white/20 bg-[#1C1D1F] px-2 py-1 text-white">Copied!</div>}
          </button>
        </div>
      </div>
      <button onClick={onDisconnect} className={'shrink-0 rounded-[10px] px-3 py-2 text-sm font-semibold text-fail hover:bg-fail hover:text-white ' + tw.quick + ' ' + tw.press}>
        Disconnect
      </button>
    </div>
  );
}

// While the wallet's own window is open.
function Connecting({ logo, name }: { logo: string; name: string }) {
  return (
    <div className="flex animate-fade items-center gap-2 rounded-md bg-[#2A2A2A] p-2">
      <Avatar src={logo} className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-white">{name}</p>
        <p className="text-xs text-[#898989]">Check your wallet</p>
      </div>
      <div className="w-6 shrink-0"><Spinner /></div>
    </div>
  );
}

/** 'choose': the EVM and ICP sections; 'icp': the ICP wallets' own step. */
export type MenuStep = 'choose' | 'icp';

export interface WalletMenuProps {
  wallets: Wallets;
  step?: MenuStep;
  /** Plug's extension answered at load; false shows its row as a link to Plug's site. */
  plug?: boolean;
  onEvm?: () => void;
  /** ICP wallet: open the ICP wallets' step. */
  onIcpList?: () => void;
  onIcp?: (w: IcpWallet) => void;
  onDisconnect?: (side: 'evm' | 'icp') => void;
}

/** Body of the wallet menu: an EVM section and an ICP section, each either its one choice or the connected wallet;
 *  or, on the 'icp' step, the ICP wallets. */
export function WalletMenu({ wallets: w, step = 'choose', plug = true, onEvm, onIcpList, onIcp, onDisconnect }: WalletMenuProps) {
  if (step === 'icp') {
    return (
      <div data-testid="wallet-menu" className="flex animate-fade flex-col gap-1">
        {ICP_WALLETS.map(([name, logo]) =>
          name === 'Plug' && !plug
            ? <GetPlug key={name} logo={logo} />
            : <WalletCard key={name} connectWallet={() => onIcp?.(name)} walletLogo={logo} walletTitle={name} />,
        )}
      </div>
    );
  }
  return (
    <div data-testid="wallet-menu" className="flex animate-fade flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label>EVM</Label>
        {w.evm && w.evm !== 'connecting' ? (
          <Connected logo={EVM_LOGO} name="EVM wallet" address={w.evm} onDisconnect={() => onDisconnect?.('evm')} />
        ) : w.evm === 'connecting' ? (
          <Connecting logo={EVM_LOGO} name="EVM wallet" />
        ) : (
          <Choice logo={EVM_LOGO} name="EVM wallet" note="MetaMask, Rabby, WalletConnect and others" onClick={onEvm} />
        )}
      </div>
      <hr className="border-[#494949]" />
      <div className="flex flex-col gap-1">
        <Label>ICP</Label>
        {w.icp?.principal ? (
          <Connected logo={w.icp.logo} name={w.icp.name} address={w.icp.principal} onDisconnect={() => onDisconnect?.('icp')} />
        ) : w.icp ? (
          <Connecting logo={w.icp.logo} name={w.icp.name} />
        ) : (
          <Choice logo={ICP_LOGO} name="ICP wallet" note="OISY, NFID, Internet Identity and Plug" onClick={onIcpList} />
        )}
      </div>
      <p className="px-2 text-xs text-[#898989]">You can connect one EVM wallet and one ICP wallet at the same time.</p>
    </div>
  );
}

// Back to the two choices, opposite the close button.
function Back({ onBack, className }: { onBack: () => void; className: string }) {
  return (
    <button type="button" aria-label="Back" onClick={onBack} className={'absolute text-white hover:opacity-70 ' + tw.quick + ' ' + tw.pressIcon + ' ' + className}>
      <ExpandLeftIcon width={20} height={20} />
    </button>
  );
}

/** Phones (below md) get the Drawer, as the live menu; read after mount so the static HTML and the first render agree. */
function usePhone(): boolean {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => setPhone(window.matchMedia('(max-width: 767px)').matches), []);
  return phone;
}

// The menu opens under the header's wallet pill (desktop) or as a sheet (phone); the pill is its trigger.
function Menu({ title, open, onOpenChange, onBack, trigger, children }: { title: string; open: boolean; onOpenChange: (o: boolean) => void; onBack?: () => void; trigger: React.ReactElement; children: React.ReactNode }) {
  const phone = usePhone();
  // The popover stays open while its content plays the exit, then closes.
  const [shown, setShown] = React.useState(open);
  React.useEffect(() => { if (open) setShown(true); }, [open]);
  if (phone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent aria-describedby={undefined} className="fixed outline-none">
          <div className="relative">
            {onBack && <Back onBack={onBack} className="left-4 top-1/2 -translate-y-1/2" />}
            <DrawerHeader className={onBack ? 'pl-12' : undefined}>{title}</DrawerHeader>
          </div>
          {children}
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Popover open={open || shown} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <AnimatePresence initial={false} onExitComplete={() => setShown(false)}>
        {open && (
          // Grows out of the pill (scale from the corner by the pill) and shrinks back into it.
          <PopoverContent asChild className="flex w-[360px] flex-col gap-y-4" align="end" sideOffset={20} onOpenAutoFocus={(e) => e.preventDefault()}>
            <motion.div variants={menu} initial="hidden" animate="shown" exit="gone" style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}>
              <div className="flex items-center justify-center font-medium text-white">
                {onBack && <Back onBack={onBack} className="left-4 top-4" />}
                <PopoverClose className={'absolute right-4 top-4 hover:opacity-70 ' + tw.quick + ' ' + tw.pressIcon}>
                  <CloseIcon width={20} height={20} />
                </PopoverClose>
                {title}
              </div>
              {children}
            </motion.div>
          </PopoverContent>
        )}
      </AnimatePresence>
    </Popover>
  );
}

/** The wallet menu wired to the wallet store: what the Header mounts with its pill as the trigger. */
export function WalletMenuButton({ trigger }: { trigger: React.ReactElement }) {
  const { evm, icp } = useWallets();
  const openEvm = useEvmConnect();
  const evmModalOpen = useEvmModalOpen();
  const connectIcp = useIcpConnect();
  const disconnect = useDisconnectWallets();
  // shared, so a page's own "Connect wallet" opens this menu too
  const { open, setOpen } = useWalletMenu();
  const [connecting, setConnecting] = React.useState<'evm' | IcpWallet | null>(null);
  // every opening starts on the two choices; set while rendering, so the old step never shows for a frame
  const [step, setStep] = React.useState<MenuStep>('choose');
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep('choose');
  }

  // "Check your wallet" ends when the wallet connects, or when AppKit's list closes without one.
  const evmListSeen = React.useRef(false);
  React.useEffect(() => {
    if (connecting !== 'evm') return;
    if (evm) { setConnecting(null); return; }
    if (evmModalOpen) evmListSeen.current = true;
    else if (evmListSeen.current) { evmListSeen.current = false; setConnecting(null); }
  }, [connecting, evm, evmModalOpen]);
  React.useEffect(() => {
    if (icp && connecting && connecting !== 'evm') setConnecting(null);
  }, [icp, connecting]);

  const icpView = (): Wallets['icp'] => {
    if (icp) {
      const known = bySigner(icp.signer);
      const [name, logo] = known ? [known[0], known[1]] : UNKNOWN_ICP;
      return { name, logo, principal: icp.principal };
    }
    if (connecting && connecting !== 'evm') {
      const [name, logo] = byName(connecting);
      return { name, logo };
    }
    return null;
  };

  const props: WalletMenuProps = {
    // the store keeps addresses lower case; people see the checksum form, as their wallet shows it
    wallets: { evm: evm ? getAddress(evm.address) : connecting === 'evm' ? 'connecting' : null, icp: icpView() },
    step,
    plug: PLUG_PRESENT,
    onEvm: () => {
      setConnecting('evm');
      void openEvm();
    },
    onIcpList: () => setStep('icp'),
    onIcp: (name) => {
      // back to the sections, where the ICP one shows "Check your wallet" and then the connected wallet
      setStep('choose');
      setConnecting(name);
      connectIcp(byName(name)[2]).then(
        () => setConnecting((c) => (c === name ? null : c)),
        () => setConnecting((c) => (c === name ? null : c)),
      );
    },
    onDisconnect: (side) => void (side === 'evm' ? disconnect.evm() : disconnect.icp()),
  };

  return (
    <Menu
      title={step === 'icp' ? 'Choose an ICP wallet' : evm && icp ? 'Your wallets' : 'Connect a wallet'}
      open={open}
      onOpenChange={setOpen}
      onBack={step === 'icp' ? () => setStep('choose') : undefined}
      trigger={trigger}
    >
      <WalletMenu {...props} />
    </Menu>
  );
}
