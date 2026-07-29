export function FloatingBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="bg-grid absolute inset-0 text-slate-900 dark:text-white opacity-40 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />
      <div className="animate-blob absolute -left-32 -top-32 size-[32rem] rounded-full bg-brand-400/30 blur-3xl dark:bg-brand-500/20" />
      <div className="animate-blob absolute -right-32 top-20 size-[28rem] rounded-full bg-accent-400/30 blur-3xl [animation-delay:4s] dark:bg-accent-500/20" />
      <div className="animate-blob absolute bottom-0 left-1/3 size-[26rem] rounded-full bg-brand-300/25 blur-3xl [animation-delay:8s] dark:bg-brand-400/15" />
    </div>
  );
}
