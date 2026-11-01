import { describe, expect, it } from 'vitest';
import { PLUG_UUID, forgetMissingPlug, plugInstalled } from './plug';

/** A page where an extension answers ICRC-94 discovery in the same tick, as Plug's page script does. */
function pageWith(uuid?: string): EventTarget {
  const win = new EventTarget();
  if (uuid) win.addEventListener('icrc94:requestProvider', () => win.dispatchEvent(new CustomEvent('icrc94:announceProvider', { detail: { uuid, name: 'X' } })));
  return win;
}

const memory = (id: string | null) => {
  const m = new Map<string, string>(id ? [['signerId', id]] : []);
  return { getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k), m };
};

describe('Plug detection', () => {
  it('finds Plug only by its own uuid, and stops listening afterwards', () => {
    expect(plugInstalled(pageWith(PLUG_UUID) as Window)).toBe(true);
    expect(plugInstalled(pageWith('b5ec333c-8854-47bd-be77-74059e0c64d6') as Window)).toBe(false);
    expect(plugInstalled(pageWith() as Window)).toBe(false);
    expect(plugInstalled(undefined)).toBe(false);
  });
  it('drops a stored Plug id when Plug is missing, and nothing else', () => {
    const gone = memory(PLUG_UUID);
    forgetMissingPlug(false, () => gone);
    expect(gone.m.has('signerId')).toBe(false);
    const there = memory(PLUG_UUID);
    forgetMissingPlug(true, () => there);
    expect(there.m.get('signerId')).toBe(PLUG_UUID);
    const oisy = memory('OISY');
    forgetMissingPlug(false, () => oisy);
    expect(oisy.m.get('signerId')).toBe('OISY');
    expect(() => forgetMissingPlug(false, () => { throw new Error('blocked'); })).not.toThrow();
  });
});
