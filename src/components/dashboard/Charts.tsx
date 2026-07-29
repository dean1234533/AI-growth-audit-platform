import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { CategoryScore, Recommendation, Severity } from '../../lib/types';
import { GlassCard } from '../ui/GlassCard';

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#94a3b8',
};

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function RadarScoreChart({ categories }: { categories: CategoryScore[] }) {
  const data = categories.map((c) => ({ category: c.label, score: c.score }));
  return (
    <ChartCard title="Score Breakdown">
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="currentColor" className="text-black/10 dark:text-white/10" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: 'currentColor' }} className="text-slate-600 dark:text-slate-300" />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} className="text-slate-400" />
          <Radar name="Score" dataKey="score" stroke="#4a63ff" fill="#4a63ff" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SeverityBarChart({ recommendations }: { recommendations: Recommendation[] }) {
  const counts = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: recommendations.filter((r) => r.severity === severity).length,
  })).filter((d) => d.count > 0);

  return (
    <ChartCard title="Issue Severity">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={counts} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="currentColor" className="text-black/5 dark:text-white/10" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="severity" tick={{ fontSize: 12 }} width={70} tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }}
            formatter={(value) => [`${value} issue${value === 1 ? '' : 's'}`, '']}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {counts.map((d) => (
              <Cell key={d.severity} fill={SEVERITY_COLORS[d.severity]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PerformanceBreakdownChart({ categories }: { categories: CategoryScore[] }) {
  const perf = categories.find((c) => c.id === 'performance');
  const data = (perf?.checks ?? []).map((c) => ({ name: c.label, score: c.passed ? 100 : 0 }));

  return (
    <ChartCard title="Performance Breakdown">
      {data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">No performance data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-black/5 dark:text-white/10" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
            <Bar dataKey="score" radius={[6, 6, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.score >= 100 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5 }}>
      <GlassCard className="p-6">
        <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">{title}</h3>
        {children}
      </GlassCard>
    </motion.div>
  );
}
