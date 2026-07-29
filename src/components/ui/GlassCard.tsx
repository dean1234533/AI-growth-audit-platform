import type { HTMLAttributes, ReactNode } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassCard({ children, className = '', ...rest }: GlassCardProps) {
  return (
    <div
      className={`glass rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
