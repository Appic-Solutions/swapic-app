// Logos for tokens the quoter's list answers without one (2026-11-04, GET /v2/tokens has no `logo` for every chain's
// native coin, the five ICP ledgers and a few bridged tokens). Used only when the answer has no logo, so a logo the
// services serve always wins. Keyed by CAIP-2 chain and address: the zero address (or "native") for a native coin, the
// ledger principal on ICP. Sources: the ck ledgers' own `icrc1:logo`, DFINITY's NNS app (ICP), Monad's and Plasma's
// brand pages (MON, XPL), Unit's site (UBTC, UETH), the Superchain token list (WETH, DAI, wstETH), and the app's own
// chain logos for ETH, POL and HYPE.
import { ICP_CHAIN } from '@/config';

const NATIVE = '0x0000000000000000000000000000000000000000';
const T = '/images/tokens';
const CHAIN = '/images/logo/chains-logos';

/** Each EVM chain's native coin. */
const NATIVE_LOGOS: Record<string, string> = {
  'eip155:1': `${CHAIN}/ethereum.svg`,
  'eip155:8453': `${CHAIN}/ethereum.svg`,
  'eip155:42161': `${CHAIN}/ethereum.svg`,
  'eip155:10': `${CHAIN}/ethereum.svg`,
  'eip155:130': `${CHAIN}/ethereum.svg`,
  'eip155:480': `${CHAIN}/ethereum.svg`,
  'eip155:137': `${CHAIN}/polygon.svg`,
  'eip155:143': `${T}/mon.svg`,
  'eip155:999': `${CHAIN}/hyperevm.svg`,
  'eip155:9745': `${T}/xpl.svg`,
};

/** The other listed ICP tokens: most ledgers' own logos are too heavy for the quoter's list or missing, so one small image
 *  per ledger (each ledger's `icrc1:logo`, or its SNS logo for CHAT, MOTOKO and GOLDAO, as 96 px WebP). */
const ICP_LEDGERS = [
  'nza5v-qaaaa-aaaar-qahzq-cai',
  'ly36x-wiaaa-aaaai-aqj7q-cai', 'l3iu2-tyaaa-aaaal-qxm4q-cai', 'buwm7-7yaaa-aaaar-qagva-cai', '2ouva-viaaa-aaaaq-aaamq-cai',
  '7pail-xaaaa-aaaas-aabmq-cai', 'dkqo7-cqaaa-aaaah-quxvq-cai', 'icaf7-3aaaa-aaaam-qcx3q-cai', 'vurva-zqaaa-aaaak-quezq-cai',
  '6c7su-kiaaa-aaaar-qaira-cai', 'ca6gz-lqaaa-aaaaq-aacwa-cai', 'hvgxa-wqaaa-aaaaq-aacia-cai', 'lkwrt-vyaaa-aaaaq-aadhq-cai',
  'd4oh6-cyaaa-aaaal-qxnkq-cai', 'igtdr-qyaaa-aaaac-qhjka-cai', 'gpmim-niaaa-aaaaj-qsnhq-cai', 'rh2pm-ryaaa-aaaan-qeniq-cai',
  'pcj6u-uaaaa-aaaak-aewnq-cai', 'tyyy3-4aaaa-aaaaq-aab7a-cai', 'k45jy-aiaaa-aaaaq-aadcq-cai', 'druyg-tyaaa-aaaaq-aactq-cai',
  '4c4fd-caaaa-aaaaq-aaa3a-cai',
];

/** Other tokens by `${chain}|${address}` (EVM addresses in lower case). */
const TOKEN_LOGOS: Record<string, string> = {
  ...Object.fromEntries(ICP_LEDGERS.map((ledger) => [`${ICP_CHAIN}|${ledger}`, `${T}/icp/${ledger}.webp`])),
  [`${ICP_CHAIN}|ryjl3-tyaaa-aaaaa-aaaba-cai`]: `${T}/icp.svg`,
  [`${ICP_CHAIN}|mxzaz-hqaaa-aaaar-qaada-cai`]: `${T}/ckbtc.svg`,
  [`${ICP_CHAIN}|ss2fx-dyaaa-aaaar-qacoq-cai`]: `${T}/cketh.svg`,
  [`${ICP_CHAIN}|xevnm-gaaaa-aaaar-qafnq-cai`]: `${T}/ckusdc.svg`,
  [`${ICP_CHAIN}|cngnf-vqaaa-aaaar-qag4q-cai`]: `${T}/ckusdt.svg`,
  'eip155:999|0x9fdbda0a5e284c32744d2f17ee5c74b284993463': `${T}/ubtc.svg`,
  'eip155:999|0xbe6727b535545c67d5caa73dea54865b92cf7907': `${T}/ueth.svg`,
  'eip155:9745|0x9895d81bb462a195b4922ed7de0e3acd007c32cb': `${T}/weth.png`,
  'eip155:480|0x4200000000000000000000000000000000000006': `${T}/weth.png`,
  'eip155:480|0x79a02482a880bce3f13e09da970dc34db4cd24d1': `${T}/usdc.png`,
  'eip155:130|0x20cab320a855b39f724131c69424240519573f81': `${T}/dai.svg`,
  'eip155:130|0xc02fe7317d4eb8753a02c35fe019786854a92001': `${T}/wsteth.svg`,
};

/** The app's own logo for a token the list gives none, or undefined. */
export function fallbackLogo(chain: string, address: string): string | undefined {
  if (address === NATIVE || address === 'native') return NATIVE_LOGOS[chain];
  return TOKEN_LOGOS[`${chain}|${chain.startsWith('eip155:') ? address.toLowerCase() : address}`];
}

/** Every file the fallback names (the test checks each exists). */
export const FALLBACK_FILES: readonly string[] = [...new Set([...Object.values(NATIVE_LOGOS), ...Object.values(TOKEN_LOGOS)])];
