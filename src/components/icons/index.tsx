// One icon set: lucide outline at one stroke (1.75). Three sizes: 16 beside small text (ICON.sm), 20 in buttons, rows
// and the nav (ICON.md, the default), 24 in titles (ICON.lg). Coin and chain logos are images, not icons.
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  ArrowDown, ArrowLeftRight, ArrowRight, ArrowUpDown, BadgeCheck, BadgePercent, Check, ChevronDown, ChevronLeft, CircleQuestionMark, Clock,
  Copy, ExternalLink, Fuel, History, Link, Lock, Network, Plus, Receipt, ScanSearch, Sparkles, TrendingUp, TriangleAlert, Wallet,
  Waves, X, Zap,
} from 'lucide-react';

export const ICON = { sm: 16, md: 20, lg: 24 } as const;

function outline(Icon: LucideIcon, name: string) {
  const Outline = (props: LucideProps) => <Icon size={ICON.md} strokeWidth={1.75} aria-hidden {...props} />;
  Outline.displayName = name;
  return Outline;
}

export const ArrowDownIcon = outline(ArrowDown, 'ArrowDownIcon');
export const ArrowRightIcon = outline(ArrowRight, 'ArrowRightIcon');
export const ArrowsUpDownIcon = outline(ArrowUpDown, 'ArrowsUpDownIcon');
export const BackIcon = outline(ChevronLeft, 'BackIcon');
export const ChainsIcon = outline(Network, 'ChainsIcon');
export const CheckIcon = outline(Check, 'CheckIcon');
export const ChevronDownIcon = outline(ChevronDown, 'ChevronDownIcon');
export const ClockIcon = outline(Clock, 'ClockIcon');
export const CloseIcon = outline(X, 'CloseIcon');
export const CopyIcon = outline(Copy, 'CopyIcon');
export const DiscountIcon = outline(BadgePercent, 'DiscountIcon');
export const EarnIcon = outline(TrendingUp, 'EarnIcon');
export const ExternalLinkIcon = outline(ExternalLink, 'ExternalLinkIcon');
export const FeeIcon = outline(Receipt, 'FeeIcon');
export const GasIcon = outline(Fuel, 'GasIcon');
export const HelpIcon = outline(CircleQuestionMark, 'HelpIcon');
export const HistoryIcon = outline(History, 'HistoryIcon');
export const LinkIcon = outline(Link, 'LinkIcon');
export const LockIcon = outline(Lock, 'LockIcon');
export const PlusIcon = outline(Plus, 'PlusIcon');
export const PoolIcon = outline(Waves, 'PoolIcon');
export const ScannerIcon = outline(ScanSearch, 'ScannerIcon');
export const SparkleIcon = outline(Sparkles, 'SparkleIcon');
export const SwapIcon = outline(ArrowLeftRight, 'SwapIcon');
export const VerifiedIcon = outline(BadgeCheck, 'VerifiedIcon');
export const WalletIcon = outline(Wallet, 'WalletIcon');
export const WarningIcon = outline(TriangleAlert, 'WarningIcon');
export const ZapIcon = outline(Zap, 'ZapIcon');
