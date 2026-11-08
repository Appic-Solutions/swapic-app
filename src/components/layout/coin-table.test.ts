import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { COINS, COIN_DIR, REST_IMAGE, STRIP } from './coin-table';

const PUBLIC = new URL('../../../public', import.meta.url).pathname;
const COINS_ROOT = `${PUBLIC}/images/coins`;

/** The folder name the coin images must have: a short hash of every file's name and bytes. */
function hashOf(dir: string) {
  const lines = readdirSync(dir).sort().map((n) => `${n}:${createHash('sha256').update(readFileSync(`${dir}/${n}`)).digest('hex')}`);
  return createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 8);
}

/** A WebP's canvas size, from its VP8X header (every coin image has one). */
function webpSize(file: string) {
  const b = readFileSync(file);
  expect(b.toString('ascii', 8, 16)).toBe('WEBPVP8X');
  return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
}

describe('the coin images', () => {
  it('sit in one folder named by their hash, so a browser may keep them forever (rename it when a file changes)', () => {
    const [folder, ...rest] = readdirSync(COINS_ROOT);
    expect(rest).toEqual([]);
    expect(`/images/coins/${folder}`).toBe(COIN_DIR);
    expect(folder, `a coin image changed: rename public/images/coins/${folder} and COIN_DIR to ${hashOf(`${PUBLIC}${COIN_DIR}`)}`).toBe(hashOf(`${PUBLIC}${COIN_DIR}`));
  });
  it('are the resting image and one strip per coin, nine frames each', () => {
    const files = readdirSync(`${PUBLIC}${COIN_DIR}`).sort();
    expect(files).toEqual(['rest.webp', ...COINS.map(([name]) => `${name}.webp`)].sort());
    for (const [name] of COINS) expect(webpSize(`${PUBLIC}${COIN_DIR}/${name}.webp`)).toEqual({ width: STRIP.cell * STRIP.frames, height: STRIP.size });
  });
  it('are named the same in the page styles', () => {
    expect(readFileSync(new URL('../../style/globals.css', import.meta.url), 'utf8')).toContain(`url('${REST_IMAGE}')`);
  });
});
