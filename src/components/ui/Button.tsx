import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';

type ConflictingHandlers = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | ConflictingHandlers> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  loading?: boolean;
  success?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[linear-gradient(120deg,#3b82f6,#4b7cff)] text-white shadow-[0_16px_36px_-12px_rgba(59,130,246,0.55)] hover:shadow-[0_20px_44px_-10px_rgba(59,130,246,0.65)]',
  secondary: 'glass text-ink dark:text-white hover:bg-white/60 dark:hover:bg-white/10',
  ghost: 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/10',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'px-5 py-2.5 text-sm rounded-2xl',
  lg: 'px-8 py-4 text-base rounded-[20px]',
};

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading,
  success,
  icon,
  className = '',
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleId = useRef(0);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const tx = useSpring(rawX, { stiffness: 300, damping: 18 });
  const ty = useSpring(rawY, { stiffness: 300, damping: 18 });

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = rippleId.current++;
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
    onClick?.(e);
  }

  function handleMouseMove(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    rawX.set((e.clientX - rect.left - rect.width / 2) * 0.18);
    rawY.set((e.clientY - rect.top - rect.height / 2) * 0.28);
  }

  function handleMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.button
      onMouseMove={disabled || loading ? undefined : handleMouseMove}
      onMouseLeave={disabled || loading ? undefined : handleMouseLeave}
      style={{ x: tx, y: ty }}
      whileHover={disabled || loading ? undefined : { scale: 1.03 }}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      disabled={disabled || loading}
      onClick={handleClick}
      className={[
        'relative inline-flex items-center justify-center gap-2 overflow-hidden font-semibold tracking-tight transition-shadow disabled:opacity-60 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          initial={{ opacity: 0.45, scale: 0 }}
          animate={{ opacity: 0, scale: 4 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="pointer-events-none absolute size-8 rounded-full bg-white/70"
          style={{ left: r.x - 16, top: r.y - 16 }}
        />
      ))}

      <span className="relative z-10 inline-flex items-center gap-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : success ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
            <Check className="size-4" />
          </motion.span>
        ) : (
          icon
        )}
        {children}
      </span>
    </motion.button>
  );
}
