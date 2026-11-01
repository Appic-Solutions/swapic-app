// Design note (Plug as an ICP wallet, 2026-11-01).
// How Plug connects: the Plug extension (2.18.1, Chrome web store build read on 2026-11-01) answers the ICRC-94 discovery
// event `icrc94:requestProvider` with a provider whose uuid is fixed (PLUG_UUID below, name "Plug Wallet", rdns
// ooo.plugwallet) and speaks ICRC-25 over it: icrc25_supported_standards lists ICRC-21, 25, 27, 34 and 49; every
// icrc49_call_canister waits for a yes in Plug's window, which shows the canister's ICRC-21 consent message. ICRC-29 is
// the popup transport and does not apply to an extension. So Plug goes through IdentityKit like OISY and NFID: an
// EXTENSION signer config in accounts mode (providers.tsx); its window.ic.plug API is never used.
// Must never happen: ICP wallets breaking for people without Plug. IdentityKit 2.0.0 builds every listed signer's
// transport at mount (Promise.all) and stays "initializing" when one fails, and an EXTENSION transport fails when the
// extension does not answer; it also keeps the last signer id in localStorage and stays "initializing" when that id is
// not listed. How the design proves it: Plug is listed only when plugInstalled() saw its answer at load (Plug's page
// script registers its listener at document_start, before ours runs, and answers in the same tick), and a stored Plug id
// is dropped when Plug is not there (forgetMissingPlug). Without Plug the menu offers its install page instead.
// Known limits: Plug answers a "no" with ICRC-25 code 3000 and the text "User rejected", not 3001, so rejection.ts does
// not read it as a no yet (an approval then shows as failed, a canister call goes to the records check); Plug returns
// every account it holds and IdentityKit takes the first (identitykit issue 393). Tested in plug.test.ts.

/** The uuid Plug's ICRC-94 provider announces; IdentityKit uses it as the signer id (its EXTENSION transport finds it by it). */
export const PLUG_UUID = '71edc834-bab2-4d59-8860-c36a01fee7b8';
/** Plug's own site, where people without the extension (phones included) get it. */
export const PLUG_INSTALL_URL = 'https://plugwallet.ooo/';
/** IdentityKit's localStorage key for the last connected signer (@nfid/identitykit 2.0.0, useProceedSigner). */
const SIGNER_KEY = 'signerId';

interface ProviderDetail { uuid?: unknown }

/** True when the Plug extension answered ICRC-94 discovery in this tick. */
export function plugInstalled(win: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'> | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win) return false;
  let found = false;
  const onAnnounce = (e: Event) => {
    if ((e as CustomEvent<ProviderDetail>).detail?.uuid === PLUG_UUID) found = true;
  };
  win.addEventListener('icrc94:announceProvider', onAnnounce);
  try {
    win.dispatchEvent(new CustomEvent('icrc94:requestProvider'));
  } finally {
    win.removeEventListener('icrc94:announceProvider', onAnnounce);
  }
  return found;
}

/** Drops IdentityKit's stored Plug id when Plug is not there, so it does not wait for a signer it cannot find. */
export function forgetMissingPlug(installed: boolean, storage: () => Pick<Storage, 'getItem' | 'removeItem'> | undefined): void {
  if (installed) return;
  try {
    const s = storage();
    if (s?.getItem(SIGNER_KEY) === PLUG_UUID) s.removeItem(SIGNER_KEY);
  } catch {
    // storage blocked (private mode): IdentityKit cannot have stored an id either
  }
}
