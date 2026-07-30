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
  critical: '#ff5a7a',
  high: '#ffb547',
  medium: '#6c63ff',
  low: '#4b7cff',
  info: '#9aa3b2',
};

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

// Short forms so the radar's category labels don't get clipped at the narrow widths
// this chart renders at (a 3-column grid on desktop, full-width on mobile).
const RADAR_LABEL_ABBREVIATIONS: Record<string, string> = {
  Performance: 'Perf.',
  Accessibility: 'A11y',
  Conversion: 'Conv.',
};

const TOOLTIP_STYLE = {
  borderRadius: 16,
  border: '1px solid rgba(108,99,255,0.15)',
  boxShadow: '0 20px 40px -16px rgba(17,24,39,0.25)',
  fontSize: 12,
  fontWeight: 600,
  padding: '10px 14px',
} as const;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function RadarScoreChart({ categories }: { categories: CategoryScore[] }) {
  const data = categories.map((c) => ({ category: RADAR_LABEL_ABBREVIATIONS[c.label] ?? c.label, score: c.score }));
  return (
    <ChartCard title="Score Breakdown">
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="60%" margin={{ top: 16, right: 28, bottom: 16, left: 28 }}>
          <defs>
            <radialGradient id="radarFill" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#6c63ff" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#4b7cff" stopOpacity={0.12} />
            </radialGradient>
          </defs>
          <PolarGrid stroke="#6c63ff" strokeOpacity={0.12} />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#9aa3b2' }} axisLine={false} />
          <Radar name="Score" dataKey="score" stroke="#6c63ff" strokeWidth={2} fill="url(#radarFill)" isAnimationActive animationDuration={1100} animationEasing="ease-out" />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} / 100`, 'Score']} />
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
        <BarChart data={counts} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={14}>
          <CartesianGrid horizontal={false} stroke="#6c63ff" strokeOpacity={0.08} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#9aa3b2' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="severity"
            tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }}
            width={70}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} issue${value === 1 ? '' : 's'}`, '']} cursor={{ fill: 'rgba(108,99,255,0.06)' }} />
          <Bar dataKey="count" radius={[0, 10, 10, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out">
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
  const data = (perf?.checks ?? []).map((c) => ({ name: truncate(c.label, 26), fullName: c.label, score: c.passed ? 100 : 0 }));

  return (
    <ChartCard title="Performance Breakdown">
      {data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm font-medium text-slate">No performance data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(260, data.length * 42)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap={12}>
            <CartesianGrid horizontal={false} stroke="#6c63ff" strokeOpacity={0.08} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#9aa3b2' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} width={160} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''} cursor={{ fill: 'rgba(108,99,255,0.06)' }} />
            <Bar dataKey="score" radius={[0, 10, 10, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out">
              {data.map((d) => (
                <Cell key={d.fullName} fill={d.score >= 100 ? '#00c48c' : '#ff5a7a'} />
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
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      <GlassCard gradientBorder className="p-7">
        <h3 className="mb-5 font-display text-lg font-bold text-ink dark:text-white">{title}</h3>
        {children}
      </GlassCard>
    </motion.div>
  );
}
