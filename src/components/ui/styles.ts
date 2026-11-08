// The shared control looks, so every screen draws them the same way (Jeff 2026-11-05).
/** Text fields and search boxes: a lighter fill, the card line, a brighter line when focused. */
export const FIELD = 'rounded-xl border border-line bg-white/[0.06] text-white outline-none transition-colors duration-100 placeholder:text-faint focus:border-line-strong focus-within:border-line-strong';
/** The second button beside a blue main button: a lighter fill and the card line; hover brightens it, nothing moves. */
export const QUIET = 'inline-flex items-center justify-center gap-x-2 rounded-xl border border-line bg-white/[0.06] font-medium text-white transition duration-100 hover:bg-white/10 active:scale-[0.97] motion-reduce:active:scale-100';
/** The card's surface and line, for what is not a Card. */
export const CARD_SURFACE = 'rounded-3xl border border-line bg-input-fields';
/** A blue tinted status box. */
export const NOTE_BLUE = 'bg-blue-500/10 ring-1 ring-inset ring-blue-400/20';
/** A yellow tinted status box. */
export const NOTE_YELLOW = 'bg-warn/10 ring-1 ring-inset ring-warn/20';
