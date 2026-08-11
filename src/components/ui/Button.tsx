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
        'relative inline-flex items-center justify-center gap-2 overflow-hidden font-semibold tracking-tight transition-shadow disabled:opacity-60 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute size-8 animate-ping rounded-full bg-white/50"
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
