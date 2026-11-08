// One short grey line under a panel's main button: what can be done now (the texts: lib/copy/hints.ts). On a short window
// it hangs in the panel's bottom padding (its parent is relative), so it never makes the panel taller; a tiny window
// leaves it out.
import { cn } from '@/lib/cn';

export function Hint({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <p data-testid="hint" className={cn('mt-2 text-center text-xs font-normal text-secondary md:short:absolute md:short:inset-x-0 md:short:top-full md:short:mt-1 md:tiny:hidden', className)}>
      {text}
    </p>
  );
}
