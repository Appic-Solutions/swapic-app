/**
 * A long amount steps down a size and then wraps, it never loses digits: a swap is confirmed on these numbers.
 * The hero is the big amount on a route card, the side the amount with its symbol on a white card (Review swap, Your swap).
 */
export const heroSize = (text: string) =>
  text.length <= 11 ? 'text-xl lg:text-3xl' : text.length <= 15 ? 'text-xl lg:text-2xl' : text.length <= 20 ? 'text-lg lg:text-xl' : 'text-sm lg:text-base';
export const sideSize = (text: string) => (text.length <= 18 ? '' : text.length <= 26 ? 'text-base md:text-xl' : 'text-sm md:text-base');
