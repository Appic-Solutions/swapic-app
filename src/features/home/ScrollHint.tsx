// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c).
import { ChevronDownIcon } from '@/components/icons';

export function ScrollHint() {
  return (
    <a href="#how" className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center gap-y-1 text-sm font-semibold text-secondary transition-colors hover:text-white max-md:hidden">
      How Swapic works
      <ChevronDownIcon width={20} height={20} className="animate-bounce" />
    </a>
  );
}
