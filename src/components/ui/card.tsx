import { cn } from '@/lib/cn';
import React from 'react';

interface CardProps extends React.AllHTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

function Card({ children, className, ...other }: CardProps) {
  return (
    <div
      className={cn(
        'group relative flex w-full items-center gap-x-7 overflow-clip',
        'rounded-3xl border border-line p-5',
        'text-xl font-semibold leading-7 text-white',
        'bg-input-fields bg-cover bg-center bg-no-repeat',
        'transition-colors duration-200',
        'md:p-6 md:text-2xl md:leading-8',
        className,
      )}
      {...other}
    >
      {children}
    </div>
  );
}

export { Card };
