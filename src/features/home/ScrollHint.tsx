// Moved from the design's home-screens.tsx (sha 04ec3f6bf50c).
import { ChevronDownIcon } from '@/components/landing/icons';

export function ScrollHint() {
  return (
    <a href="#how" className="mt-6 flex flex-col items-center gap-y-1 text-sm font-semibold text-[#898989] transition-colors hover:text-white max-md:hidden">
      How Swapic works
      <ChevronDownIcon width={22} height={22} className="animate-bounce" />
    </a>
  );
}
