// The Scanner and History panels fit the window on desktop, so their list is the one scroll and the page never scrolls:
// their max height is the window less the page frame around them (--frame-top: header, nav and gap above the panel;
// --frame-bottom: the gap below it, with the bottom nav under xl; both set by the shell for each window size), capped at the
// panel's own tallest. The fallbacks are today's frame (94 px above and 128 px below under xl, 106 px and 32 px at xl).
// Tailwind reads whole class names from the source, so each cap is spelled out.

/** The Scanner panel: 800 px at most. */
export const FIT_SCANNER =
  'md:max-h-[min(800px,calc(100dvh-var(--frame-top,94px)-var(--frame-bottom,128px)))] xl:max-h-[min(800px,calc(100dvh-var(--frame-top,106px)-var(--frame-bottom,32px)))]';

/** The History panel: 760 px at most. */
export const FIT_HISTORY =
  'md:max-h-[min(760px,calc(100dvh-var(--frame-top,94px)-var(--frame-bottom,128px)))] xl:max-h-[min(760px,calc(100dvh-var(--frame-top,106px)-var(--frame-bottom,32px)))]';
