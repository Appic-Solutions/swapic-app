import { cn } from '@/lib/cn';
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  description: string;
  icon: ReactNode;
  className?: string;
  isActive?: boolean;
  customOnClick?: () => void;
}

export default function CustomCard({ label, description, icon, customOnClick, className, isActive: _isActive, ...props }: CardProps) {
  return (
    <div onClick={customOnClick} className={cn('flex flex-col gap-y-3 rounded-3xl border border-line bg-input-fields p-5 text-white md:p-6', className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-secondary">{icon}</span>
      </div>
      <p className="text-sm font-normal leading-6 text-secondary">{description}</p>
    </div>
  );
}
