import { readFileSync, writeFileSync } from 'node:fs';
const SRC = '/Users/jeff/appic/.worktrees/swapic-backend-simplify/config/tokens';
const CHAINS = { ethereum: ['eip155:1', 1], polygon: ['eip155:137', 137], base: ['eip155:8453', 8453], arbitrum: ['eip155:42161', 42161], icp: ['icp:737ba355e855bd4b61279056603e0550', 0] };
for (const [file, [caip2, n]] of Object.entries(CHAINS)) {
  const { tokens } = JSON.parse(readFileSync(`${SRC}/${file}.json`, 'utf8'));
  const rows = tokens.map((t) => ({
    address: t.address === 'native' ? '0x0000000000000000000000000000000000000000' : t.address.toLowerCase().startsWith('0x') ? t.address.toLowerCase() : t.address,
    symbol: t.symbol, name: t.symbol, decimals: t.decimals, verified: true, class: t.class,
  }));
  rows.sort((a, b) => (a.address === '0x0000000000000000000000000000000000000000' ? -1 : b.address === '0x0000000000000000000000000000000000000000' ? 1 : 0));
  writeFileSync(new URL(`../../tests/fixtures/contract/tokens-${n}.json`, import.meta.url), JSON.stringify({ chain: caip2, tokens: rows }, null, 2) + '\n');
}
console.log('tokens fixtures written');
