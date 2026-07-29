import type { HTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
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
    <motion.div
      onMouseMove={isStatic ? undefined : onMouseMove}
      whileHover={isStatic ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={[
        'glass relative rounded-[28px] transition-shadow duration-300',
        isStatic ? '' : 'cursor-glow hover:shadow-[0_32px_64px_-24px_rgba(108,99,255,0.35)]',
        gradientBorder ? 'gradient-border gradient-border-brand' : '',
        className,
      ].join(' ')}
      style={style}
      {...rest}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
