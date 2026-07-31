import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/GlassCard';
import type { AuditResult } from '../../lib/types';

interface ScoreTrendChartProps {
  scans: Pick<AuditResult, 'scannedAt' | 'overallScore'>[];
}

export function ScoreTrendChart({ scans }: ScoreTrendChartProps) {
  const data = scans.map((s) => ({
    date: new Date(s.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    score: s.overallScore,
  }));

  return (
    <GlassCard gradientBorder className="p-7">
      <h3 className="mb-5 font-display text-lg font-bold text-ink dark:text-white">Score Trend</h3>
      {data.length < 2 ? (
        <div className="flex h-[220px] items-center justify-center text-center text-sm font-medium text-slate">
          Run at least two scans to see a trend here.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke="#3b82f6" strokeOpacity={0.08} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9aa3b2' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#9aa3b2' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid rgba(59,130,246,0.15)', fontSize: 12, fontWeight: 600 }} />
            <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} isAnimationActive animationDuration={900} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </GlassCard>
  );
}
