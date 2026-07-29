import { useEffect, useState } from 'react';
import { animate, useMotionValue } from 'framer-motion';

export function AnimatedCounter({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const motionValue = useMotionValue(0);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsubscribe = motionValue.on('change', (v) => setDisplay(Math.round(v)));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, duration, motionValue]);

  return <span>{display}</span>;
}
