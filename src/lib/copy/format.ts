import { formatAmount, formatUnits } from '@/lib/money';

const STABLE = new Set(['USDC', 'USDT', 'ckUSDC', 'ckUSDT']);

export const short = (a: string) => (a.length <= 13 ? a : a.startsWith('0x') ? `${a.slice(0, 6)}…${a.slice(-4)}` : `${a.slice(0, 5)}…${a.slice(-3)}`);

/** Stable coins with two decimals (119.80), the rest with four significant digits (0.002403). */
export function tokenAmountText(value: bigint, decimals: number, symbol: string): string {
  if (!STABLE.has(symbol)) return formatAmount(value, decimals);
  const t = formatUnits(value, decimals, 2);
  const [w, f = ''] = t.split('.');
  return `${w}.${f.padEnd(2, '0')}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const clockText = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
export function dayText(ms: number, nowMs: number): string {
  const d = new Date(ms), n = new Date(nowMs);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, n)) return 'Today';
  if (sameDay(d, new Date(nowMs - 86_400_000))) return 'Yesterday';
  return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
}
export const tookText = (ms: number) => (ms < 60_000 ? `${(Math.round(ms / 100) / 10).toString()} sec` : `${Math.round(ms / 60_000)} min`);
export function etaLeftText(etaAt: number | null, nowSec: number): string | null {
  // past the estimate no number: a frozen "about 1 sec" reads as stuck
  if (etaAt === null || etaAt <= nowSec) return null;
  const left = etaAt - nowSec;
  return left < 90 ? `About ${left} sec left` : `About ${Math.round(left / 60)} min left`;
}
