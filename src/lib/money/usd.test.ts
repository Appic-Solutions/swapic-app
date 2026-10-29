import { describe, expect, it } from 'vitest';
import { dollarsToMicro, formatBps, formatUsd, formatUsdWhole, usdMicro } from './index';

describe('usd', () => {
  it('values an amount at the quoter price, floored to micro dollars', () => {
    expect(usdMicro(250_000_000n, 6, '1')).toBe(250_000_000n);
    expect(usdMicro(240_300n, 8, '103750')).toBe(249_311_250n);
    expect(usdMicro(5n * 10n ** 18n, 18, '0.8636')).toBe(4_318_000n);
    expect(usdMicro(1_937_098_750_300_072n, 18, '3920.10')).toBe(7_593_620n);
    expect(usdMicro(1n, 6, null)).toBeNull();
  });
  it('formats dollars', () => {
    expect(formatUsd(249_311_250n)).toBe('$249.31');
    expect(formatUsd(1_192_805_102n)).toBe('$1,192.80');
    expect(formatUsd(-1_200_000n)).toBe('-$1.20');
    expect(formatUsdWhole(8_420_550_000n)).toBe('$8,420');
    expect(dollarsToMicro('412880.12')).toBe(412_880_120_000n);
  });
  it('formats basis points with one decimal', () => {
    expect(formatBps(420)).toBe('4.2%');
    expect(formatBps(9961)).toBe('99.6%');
    expect(formatBps(0)).toBe('0.0%');
  });
});
