// Receive at (the To card's menu, ReceiveAt.tsx): what it offers, and when a wallet that connects takes the payout over.
// The rule (review 2026-11-08): the payout target never changes without the person choosing it. "Connect a wallet" is
// such a choice, but only while it stands: any later choice (Paste an address, Your wallet), an address typed, another To
// token, or the connect flow ending without a wallet ends it, so a wallet connected later (from the header, say) never
// moves a payout off an address the person typed.

export type ReceiveItem = 'own' | 'connect' | 'paste';

/**
 * The menu's items: the connected wallet that can receive (`own`), else "Connect a wallet", then "Paste an address". A
 * smart wallet sending to another EVM chain must type the address that receives there (smartWalletTypesRecipient): its
 * wallet is connected already, so it gets Paste an address alone (the smart wallet note under the field says why).
 */
export function receiveItems({ own, smart }: { own: string | null; smart: boolean }): ReceiveItem[] {
  if (own) return ['own', 'paste'];
  if (smart) return ['paste'];
  return ['connect', 'paste'];
}

/** "Connect a wallet" chosen: the To token's kind and key, and the address field as it was at that moment. */
export interface ConnectAsk { kind: 'evm' | 'icp' | 'sol'; toKey: string; address: string }

export type AskEvent =
  | { kind: 'connect'; wallet: 'evm' | 'icp' | 'sol'; toKey: string; address: string }
  /** Another choice in the menu (Paste an address, Your wallet), or an address typed in the field. */
  | { kind: 'paste' } | { kind: 'own' } | { kind: 'typed' }
  | { kind: 'toChanged'; toKey: string | null }
  /** The connect flow ended without a wallet (AppKit's list closed, the ICP connect cancelled). */
  | { kind: 'ended' };

export function nextAsk(ask: ConnectAsk | null, e: AskEvent): ConnectAsk | null {
  switch (e.kind) {
    case 'connect': return { kind: e.wallet, toKey: e.toKey, address: e.address };
    case 'toChanged': return ask && ask.toKey === e.toKey ? ask : null;
    default: return null;
  }
}

/**
 * A wallet that can receive the To token has connected: does the payout move to it (the address field closes)? Only for
 * an ask still standing, for the same To token, with the field open and its address as it was when the person asked.
 */
export function connectTakesOver(ask: ConnectAsk | null, now: { toKey: string | null; show: boolean; address: string }): boolean {
  return !!ask && now.show && now.toKey === ask.toKey && now.address === ask.address;
}
