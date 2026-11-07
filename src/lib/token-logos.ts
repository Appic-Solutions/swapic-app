// Logos for tokens the quoter's list answers without one (2026-11-04, GET /v2/tokens has no `logo` for every chain's
// native coin, the five ICP ledgers and a few bridged tokens). Used only when the answer has no logo, so a logo the
// services serve always wins. Keyed by CAIP-2 chain and address: the zero address (or "native") for a native coin, the
// ledger principal on ICP. Sources: the ck ledgers' own `icrc1:logo`, DFINITY's NNS app (ICP), Monad's and Plasma's
// brand pages (MON, XPL), Unit's site (UBTC, UETH), the Superchain token list (WETH, DAI, wstETH), and the app's own
// chain logos for ETH, POL and HYPE.
import { ICP_CHAIN } from '@/config';
import type { TokensAnswer } from '@/lib/api';

const NATIVE = '0x0000000000000000000000000000000000000000';
/** How Swapic's orders write a chain's own coin (the token list writes it as the zero address). */
const ORDER_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const isNative = (address: string) => address === NATIVE || address === 'native' || address.toLowerCase() === ORDER_NATIVE;
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

/** Tokens whose list logo shows badly, ours used even where the list gives one: CoinMarketCap's
 *  WETH runs its artwork to the edge, so the round crop cuts its ring off. */
const OWN_FIRST: Record<string, string> = Object.fromEntries(
  [
    'eip155:1|0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    'eip155:8453|0x4200000000000000000000000000000000000006',
    'eip155:10|0x4200000000000000000000000000000000000006',
    'eip155:130|0x4200000000000000000000000000000000000006',
    'eip155:480|0x4200000000000000000000000000000000000006',
    'eip155:42161|0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    'eip155:137|0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
    'eip155:9745|0x9895d81bb462a195b4922ed7de0e3acd007c32cb',
  ].map((key) => [key, `${T}/weth.png`]),
);

/** The app's own logo where it is preferred over the list's, or undefined. */
export function ownLogo(chain: string, address: string): string | undefined {
  return OWN_FIRST[`${chain}|${chain.startsWith('eip155:') ? address.toLowerCase() : address}`];
}

/** The app's own logo for a token the list gives none, or undefined. */
export function fallbackLogo(chain: string, address: string): string | undefined {
  if (isNative(address)) return NATIVE_LOGOS[chain];
  return TOKEN_LOGOS[`${chain}|${chain.startsWith('eip155:') ? address.toLowerCase() : address}`];
}

/** A token's logo in the quoter's list for its chain (GET /v2/tokens?q=<address>): the listed token by its address, the
 *  chain's own coin for an order's 0xEeee…; null when the list holds it with no logo or not at all. */
export function logoInList(answer: TokensAnswer, address: string): string | null {
  const want = isNative(address) ? NATIVE : address.toLowerCase();
  return answer.tokens.find((t) => t.address.toLowerCase() === want)?.logo ?? null;
}
/** Every file the fallback names (the test checks each exists). */
export const FALLBACK_FILES: readonly string[] = [...new Set([...Object.values(NATIVE_LOGOS), ...Object.values(TOKEN_LOGOS), ...Object.values(OWN_FIRST)])];
