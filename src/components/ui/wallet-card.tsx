import { Avatar } from '@/components/ui/avatar';

interface WalletCardProps {
  connectWallet: () => void;
  walletLogo: string;
  walletTitle: string;
}

export default function WalletCard({ connectWallet, walletLogo, walletTitle }: WalletCardProps) {
  return (
    <div
      onClick={() => connectWallet()}
      className="flex cursor-pointer items-center gap-2 rounded-xl p-2 duration-200 hover:bg-white/[0.06]"
    >
      <Avatar src={walletLogo} className="h-12 w-12" />
      <span className="font-semibold text-white">{walletTitle}</span>
    </div>
  );
}
