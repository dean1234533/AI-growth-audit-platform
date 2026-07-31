export function FloatingBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="bg-grid absolute inset-0 text-slate-900 dark:text-white opacity-[0.35] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black,transparent)]" />
      <div className="bg-noise absolute inset-0" />

      <div className="animate-blob absolute -left-40 -top-40 size-[36rem] rounded-full bg-brand-400/25 blur-[100px] dark:bg-brand-500/15" />
      <div className="animate-blob absolute -right-40 top-10 size-[32rem] rounded-full bg-accent-400/25 blur-[100px] [animation-delay:5s] dark:bg-accent-500/15" />
      <div className="animate-blob absolute bottom-0 left-1/3 size-[30rem] rounded-full bg-mint-400/15 blur-[110px] [animation-delay:10s] dark:bg-mint-500/10" />

      <div className="animate-float-slow absolute left-[12%] top-[22%] size-2 rounded-full bg-brand-500/60 shadow-[0_0_20px_6px_rgba(59,130,246,0.35)]" />
      <div className="animate-float-slow absolute right-[16%] top-[35%] size-1.5 rounded-full bg-accent-500/60 shadow-[0_0_16px_5px_rgba(75,124,255,0.35)] [animation-delay:3s]" />
      <div className="animate-float-slow absolute left-[22%] bottom-[18%] size-2 rounded-full bg-mint-500/60 shadow-[0_0_18px_6px_rgba(0,196,140,0.3)] [animation-delay:6s]" />
    </div>
  );
}
