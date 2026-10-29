import { create } from 'zustand';
import type { Tab } from '@/components/layout/Nav';

/** A tab page showing another tab's page in place (History opening an order shows the Scanner's order page) moves the nav
 *  highlight there while it shows (motion row 58); null: the page's own tab. */
export const useNavTab = create<{ override: Tab | null; set: (t: Tab | null) => void }>((set) => ({ override: null, set: (override) => set({ override }) }));
