export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />
    </div>
  );
}
