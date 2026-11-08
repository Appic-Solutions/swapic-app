// Panels on short windows (a laptop at 125% scale: short: is 768 px wide or more and at most 780 px high, tiny: at most
// 560 px high). The page frame says what it takes above and below a panel (globals.css --frame-top and --frame-bottom);
// a page that keeps room of its own under the panel (Swap's hint) sets --page-reserve. These classes are the compact
// spacing one panel view uses there, and the window height a panel's body may take before it scrolls inside.

/** A MorphFrame view on a short window: less padding around its content and between its parts. */
export const COMPACT_VIEW = 'md:short:gap-4 md:short:p-6 md:tiny:gap-3 md:tiny:p-5';

/**
 * A TwoColumn body on a short window: at most the window less the frame, the page's reserve and the panel's own parts
 * (the compact padding, the title and its gap, and below 1024 px the button under the body), then it scrolls inside.
 * md 160 = 48 padding + 32 title + 16 gap + 16 gap + 48 button; tiny 144 = 40 + 32 + 12 + 12 + 48; from lg the button sits
 * in the left column: 96 = 48 + 32 + 16, tiny 84 = 40 + 32 + 12.
 */
export const BODY_FIT = [
  'md:short:max-h-[calc(100dvh-var(--frame-top)-var(--frame-bottom)-var(--page-reserve,0px)-160px)]',
  'md:tiny:max-h-[calc(100dvh-var(--frame-top)-var(--frame-bottom)-var(--page-reserve,0px)-144px)]',
  'lg:short:max-h-[calc(100dvh-var(--frame-top)-var(--frame-bottom)-var(--page-reserve,0px)-96px)]',
  'lg:tiny:max-h-[calc(100dvh-var(--frame-top)-var(--frame-bottom)-var(--page-reserve,0px)-84px)]',
].join(' ');
