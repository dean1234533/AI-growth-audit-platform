import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

type ConflictingHandlers = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | ConflictingHandlers> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30',
  secondary:
    'glass text-current hover:bg-white/20',
  ghost: 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/10',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-8 py-4 text-base rounded-2xl',
};

export function Button({ children, variant = 'primary', size = 'md', loading, icon, className = '', disabled, ...rest }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-shadow disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </motion.button>
  );
}
