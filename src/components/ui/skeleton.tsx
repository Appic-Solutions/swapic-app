import { cn } from '@/lib/cn';

type SkeletonProps = React.HTMLAttributes<HTMLSpanElement>;

// A span, so it can stand in for a word inside a <p>. The sweep is the .skeleton class (globals.css).
export default function Skeleton({ className, ...props }: SkeletonProps) {
  return <span aria-hidden className={cn('skeleton rounded-full', className)} {...props} />;
}

/**
 * One line of text that has not loaded. Give it the real line's text classes and a width: the empty character makes the
 * real line box (its font size and line height, inherited ones too), and the bar sits inside it, so nothing moves when the
 * text arrives.
 */
export function SkeletonText({ className, ...props }: SkeletonProps) {
  return (
    <span aria-hidden className={cn('flex items-center', className)} {...props}>
      {'​'}
      <Skeleton className="h-[0.75em] w-full" />
    </span>
  );
}
