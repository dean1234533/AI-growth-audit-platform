export interface ScoreBand {
  label: string;
  color: string;
  textClass: string;
  bgClass: string;
  ringClass: string;
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return { label: 'Excellent', color: '#00c48c', textClass: 'text-mint-600 dark:text-mint-400', bgClass: 'bg-mint-500/10', ringClass: 'ring-mint-500/25' };
  if (score >= 70) return { label: 'Good', color: '#4b7cff', textClass: 'text-accent-600 dark:text-accent-400', bgClass: 'bg-accent-500/10', ringClass: 'ring-accent-500/25' };
  if (score >= 50) return { label: 'Needs Work', color: '#ffb547', textClass: 'text-amber-600 dark:text-amber-400', bgClass: 'bg-amber-500/10', ringClass: 'ring-amber-500/25' };
  return { label: 'Critical', color: '#ff5a7a', textClass: 'text-rose-600 dark:text-rose-400', bgClass: 'bg-rose-500/10', ringClass: 'ring-rose-500/25' };
}
