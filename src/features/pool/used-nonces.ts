const KEY = 'swapic-withdraw-nonces-v1';
function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; }
}
export const usedNonces = {
  has: (n: string) => read().includes(n),
  add: (n: string) => { try { localStorage.setItem(KEY, JSON.stringify([...read(), n].slice(-200))); } catch { /* private mode: the canister still refuses a reuse */ } },
};
