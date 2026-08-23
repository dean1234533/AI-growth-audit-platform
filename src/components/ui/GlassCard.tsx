import type { HTMLAttributes, ReactNode } from 'react';
import { useCursorGlow } from '../../lib/useCursorGlow';

interface GlassCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'> {
  children: ReactNode;
  /** Disable the hover-lift + cursor glow, for cards that shouldn't feel "clickable" */
  static?: boolean;
  /** Render a subtle animated gradient border instead of a flat one */
  gradientBorder?: boolean;
}

export function GlassCard({ children, className = '', style, static: isStatic, gradientBorder, ...rest }: GlassCardProps) {
  const onMouseMove = useCursorGlow<HTMLDivElement>();

  return (
    <div
      onMouseMove={isStatic ? undefined : onMouseMove}
      className={[
        'glass relative rounded-2xl transition duration-200',
        isStatic ? '' : 'hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-24px_rgba(59,130,246,0.35)]',
        gradientBorder ? 'gradient-border gradient-border-brand' : '',
        className,
      ].join(' ')}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
