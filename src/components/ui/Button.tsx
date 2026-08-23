import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
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
    'bg-brand-500 text-white shadow-[0_14px_30px_-14px_rgba(59,130,246,0.75)] hover:bg-brand-400 hover:shadow-[0_18px_38px_-14px_rgba(59,130,246,0.8)]',
  secondary: 'border border-ink/10 bg-white/80 text-ink shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/10',
  ghost: 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/[0.06]',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'rounded-xl px-5 py-2.5 text-sm',
  lg: 'rounded-xl px-7 py-3.5 text-sm',
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

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = rippleId.current++;
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
    onClick?.(e);
  }

  return (
    <button
      disabled={disabled || loading}
      onClick={handleClick}
      className={[
        'relative inline-flex items-center justify-center gap-2 overflow-hidden font-semibold tracking-tight transition disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute size-8 animate-ping rounded-full bg-white/30"
          style={{ left: r.x - 16, top: r.y - 16 }}
        />
      ))}

      <span className="relative z-10 inline-flex items-center gap-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : success ? (
          <span>
            <Check className="size-4" />
          </span>
        ) : (
          icon
        )}
        {children}
      </span>
    </button>
  );
}
