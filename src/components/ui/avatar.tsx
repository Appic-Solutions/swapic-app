'use client';
import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/cn';
import Skeleton from './skeleton';

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
}

const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, src, alt = '', fallback, ...props }, ref) => {
    // Sweeps only while the logo loads: a logo that failed stays a still circle, it never shimmers forever.
    const [status, setStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
    return (
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(
          'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
          '*:h-full *:w-full',
          className,
        )}
        {...props}
      >
        <AvatarPrimitive.Image className="aspect-square" src={src} alt={alt} onLoadingStatusChange={setStatus} />
        <AvatarPrimitive.Fallback className="flex items-center justify-center rounded-full bg-white/10">
          {fallback ?? (status === 'loading' && <Skeleton className="h-full w-full bg-transparent" />)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
    );
  },
);

Avatar.displayName = 'Avatar';

export { Avatar };
