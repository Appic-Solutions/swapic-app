import { describe, expect, it } from 'vitest';
import { AmountError, formatAmount, formatUnits, parseDecimal, parseSigned, parseUnits } from './index';

describe('parseUnits', () => {
  it('reads what people type', () => {
    expect(parseUnits('250', 6)).toBe(250_000_000n);
    expect(parseUnits('0.002403', 8)).toBe(240_300n);
    expect(parseUnits('1.', 6)).toBe(1_000_000n);
    expect(parseUnits('.5', 6)).toBe(500_000n);
    expect(parseUnits('  2 ', 6)).toBe(2_000_000n);
  });
  it('stays exact past 2^53', () => {
    expect(parseUnits('123456789012.345678901234567891', 18)).toBe(123456789012345678901234567891n);
  });
  it('refuses commas, exponents, signs, empty and too many decimals', () => {
    for (const bad of ['1,5', '1,204.55', '1e3', '-1', '', '.', 'abc', '1.1234567']) {
      expect(() => parseUnits(bad, 6), bad).toThrow(AmountError);
    }
  });
});

describe('formatUnits and formatAmount', () => {
  it('groups thousands and truncates, never rounds up', () => {
    expect(formatUnits(1_234_567_890n, 6)).toBe('1,234.56789');
    expect(formatUnits(1_234_567_890n, 6, 2)).toBe('1,234.56');
    expect(formatUnits(5n, 6)).toBe('0.000005');
    expect(formatUnits(10n ** 30n, 18, 4)).toBe('1,000,000,000,000');
    expect(formatUnits(0n, 6)).toBe('0');
  });
  it('shows four significant digits under one, four decimals above', () => {
    expect(formatAmount(240_300n, 8)).toBe('0.002403');
    expect(formatAmount(1_937_098_750_300_072n, 18)).toBe('0.001937');
    expect(formatAmount(4_747_233n, 6)).toBe('4.7472');
    expect(formatAmount(0n, 6)).toBe('0');
  });
});

describe('parseSigned and parseDecimal', () => {
  it('reads the signed earned field', () => {
    expect(parseSigned('-1200')).toBe(-1200n);
    expect(parseSigned('12400000')).toBe(12_400_000n);
    expect(() => parseSigned('1.5')).toThrow(AmountError);
  });
  it('scales a price, truncating digits past the scale', () => {
    expect(parseDecimal('0.8636', 18)).toBe(863_600_000_000_000_000n);
    expect(parseDecimal('3920.10', 2)).toBe(392_010n);
    expect(parseDecimal('0.123456789', 4)).toBe(1_234n);
  });
});
