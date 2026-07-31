import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { scoreBand } from '../../lib/scoreBand';

interface ScoreCircleProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function ScoreCircle({ score, size = 220, strokeWidth, showLabel = true }: ScoreCircleProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const stroke = strokeWidth ?? size * 0.07;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMotionValue(0);
  const dashoffset = useTransform(progress, (v) => circumference - (v / 100) * circumference);

  useEffect(() => {
    const controls = animate(progress, score, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    const unsubscribe = progress.on('change', (v) => setDisplayScore(Math.round(v)));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [score, progress]);

  const color = scoreBand(score).color;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="animate-glow-pulse absolute inset-[8%] rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${color}33, transparent 70%)` }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-ink/[0.06] dark:text-white/[0.08]" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashoffset, filter: `drop-shadow(0 0 10px ${color}88)` }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display font-extrabold tracking-tight text-ink dark:text-white"
            style={{ fontSize: size * 0.21, lineHeight: 1 }}
          >
            {displayScore}
          </span>
          {size >= 90 && (
            <span className="font-medium text-slate" style={{ fontSize: size * 0.062 }}>
              / 100
            </span>
          )}
        </div>
      )}
    </div>
  );
}
