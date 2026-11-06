import { cn } from '@/lib/cn';
import { BackIcon } from '@/components/icons';

interface BoxHeaderProps {
  title: string;
  onBack?: () => void;
  className?: string;
}

export default function BoxHeader({ title, onBack, className }: BoxHeaderProps) {
  return (
    <div className={cn('flex items-center justify-center text-white', className)}>
      {onBack && (
        <button
          onClick={onBack}
          className={cn(
            'flex items-center justify-center gap-x-1',
            'absolute left-0 text-sm font-medium text-secondary transition-colors hover:text-white md:left-8',
          )}
        >
          <BackIcon width={20} height={20} />
          Back
        </button>
      )}
      <p className="text-2xl font-semibold md:text-3xl">{title}</p>
    </div>
  );
}
