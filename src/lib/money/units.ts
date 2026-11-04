/** Amounts are bigint in the token's smallest unit. Text only at the edges (spec section 11). */
export class AmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmountError';
  }
}

const TYPED = /^(\d*)(?:\.(\d*))?$/;

/** What a person typed, in smallest units. Accepts `1.` and `.5`; refuses commas, signs and exponents. */
export function parseUnits(text: string, decimals: number): bigint {
  const t = text.trim();
  const m = TYPED.exec(t);
  if (!m || t === '' || t === '.') throw new AmountError('Enter a number');
  const whole = m[1] ?? '';
  const frac = m[2] ?? '';
  if (frac.length > decimals) throw new AmountError(`At most ${decimals} decimals`);
  return BigInt((whole || '0') + frac.padEnd(decimals, '0'));
}

/** A decimal string scaled by 10^scale, digits past the scale dropped (prices, dollars). */
export function parseDecimal(text: string, scale: number): bigint {
  const m = TYPED.exec(text.trim());
  if (!m || text.trim() === '' || text.trim() === '.') throw new AmountError('not a decimal');
  const frac = (m[2] ?? '').slice(0, scale).padEnd(scale, '0');
  return BigInt((m[1] || '0') + frac);
}

/** A whole number that may be negative (the account's `earned`, contract 5.5). */
export function parseSigned(text: string): bigint {
  if (!/^-?\d+$/.test(text)) throw new AmountError('not a whole number');
  return BigInt(text);
}

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Grouped, truncated to `maxFraction` decimals, trailing zeros dropped. */
export function formatUnits(value: bigint, decimals: number, maxFraction = decimals): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = group((v / base).toString());
  const frac = (v % base).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
  return (neg ? '-' : '') + whole + (frac ? `.${frac}` : '');
}

/** Whether `text` may stand in an amount box: digits and at most one point, nothing else (never a sign or an exponent, which
 *  a number input otherwise takes: "-5", "1e5"). Empty is allowed: the box was cleared. */
export const isAmountText = (text: string) => /^\d*\.?\d*$/.test(text);

/** Keys a number input takes that no amount may hold. */
export const NOT_AMOUNT_KEYS = new Set(['-', '+', 'e', 'E']);

/** A balance in a token list, where every row's figure must fit one narrow column: as [`formatAmount`], with anything
 *  under 0.0001 shown as `<0.0001` rather than its every leading zero. */
export function formatListAmount(value: bigint, decimals: number): string {
  if (value > 0n && value * 10_000n < 10n ** BigInt(decimals)) return '<0.0001';
  return formatAmount(value, decimals);
}

/** Four significant digits under one (0.002403), four decimals above (4.7472), truncated. */
export function formatAmount(value: bigint, decimals: number): string {
  if (value === 0n) return '0';
  const base = 10n ** BigInt(decimals);
  if (value >= base || value <= -base) return formatUnits(value, decimals, 4);
  const neg = value < 0n;
  const frac = (neg ? -value : value).toString().padStart(decimals, '0');
  const first = frac.search(/[1-9]/);
  const kept = frac.slice(0, first + 4).replace(/0+$/, '');
  return `${neg ? '-' : ''}0.${kept}`;
}
