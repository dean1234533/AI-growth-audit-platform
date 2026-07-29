import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface ScoreCircleProps {
  score: number;
  size?: number;
  label?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

export function ScoreCircle({ score, size = 220, label = 'Website Score' }: ScoreCircleProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const stroke = size * 0.08;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMotionValue(0);
  const dashoffset = useTransform(progress, (v) => circumference - (v / 100) * circumference);

  useEffect(() => {
    const controls = animate(progress, score, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    const unsubscribe = progress.on('change', (v) => setDisplayScore(Math.round(v)));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [score, progress]);

  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-black/5 dark:text-white/10" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashoffset }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-slate-900 dark:text-white">{displayScore}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">/ 100</span>
        </div>
      </div>
      <span className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-200">{label}</span>
    </div>
  );
}
