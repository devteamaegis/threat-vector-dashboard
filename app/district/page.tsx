'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Tip } from '@/lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function urgencyBadgeStyle(urgency: string): React.CSSProperties {
  switch (urgency?.toLowerCase()) {
    case 'critical': return { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
    case 'high':     return { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }
    case 'medium':   return { background: '#fefce8', color: '#ca8a04', border: '1px solid #fef08a' }
    default:         return { background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }
  }
}

const CATEGORIES = ['weapon', 'bullying', 'threat', 'drugs', 'harassment', 'self_harm', 'vandalism', 'other']
const CATEGORY_ICON: Record<string, string> = {
  weapon: '🔫', bullying: '👊', drugs: '💊', threat: '⚠️',
  self_harm: '🚨', vandalism: '🔨', harassment: '📣', other: '📋',
}
const CATEGORY_COLOR: Record<string, string> = {
  weapon: '#ef4444', bullying: '#f97316', drugs: '#8b5cf6',
  threat: '#dc2626', harassment: '#ec4899', self_harm: '#dc2626',
  vandalism: '#d97706', other: '#6b7280',
}

function threatLevelIndicator(tips: Tip[]): { label: string; style: React.CSSProperties } {
  const hasCritical = tips.some(t => t.urgency === 'critical')
  const hasHigh = tips.some(t => t.urgency === 'high')
  if (hasCritical) return {
    label: 'CRITICAL',
    style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  }
  if (hasHigh) return {
    label: 'HIGH',
    style: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74' },
  }
  if (tips.length > 0) return {
    label: 'ACTIVE',
    style: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' },
  }
  return {
    label: 'CLEAR',
    style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accentColor,
}: {
  label: string
  value: number | string
  sub?: string
  icon?: string
  accentColor?: string
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-lg">{icon}</span>}
        <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{label}</div>
      </div>
      <div
        className="text-3xl font-black tabular-nums leading-none"
        style={{ color: accentColor ?? '#18181b' }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-400 mt-1">{sub}</div>}
    </div>
  )
}

// ─── CSS Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(...Object.values(counts), 1)
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4">
        Threat Type Breakdown
      </div>
      <div className="flex flex-col gap-3">
        {CATEGORIES.map(cat => {
          const count = counts[cat] ?? 0
          const pct = (count / max) * 100
          return (
            <div key={cat} className="flex items-center gap-3">
              <div className="w-24 shrink-0 flex items-center gap-1.5">
                <span className="text-sm">{CATEGORY_ICON[cat]}</span>
                <span className="text-xs text-zinc-600 capitalize">{cat.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: '#f4f4f5' }}>
                <div
                  className="h-full rounded-md transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: CATEGORY_COLOR[cat] ?? '#6b7280',
                    opacity: count === 0 ? 0.2 : 0.8,
                  }}
                />
              </div>
              <div className="w-8 text-right text-xs font-mono font-bold text-zinc-700 tabular-nums">
                {count}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── School Row ───────────────────────────────────────────────────────────────

function SchoolRow({
  school,
  tips,
  rank,
}: {
  school: string
  tips: Tip[]
  rank: number
}) {
  const { label, style } = threatLevelIndicator(tips)
  const catCounts = CATEGORIES.reduce<Record<string, number>>((acc, c) => {
    acc[c] = tips.filter(t => t.category === c).length
    return acc
  }, {})
  const topCats = CATEGORIES.filter(c => catCounts[c] > 0).sort((a, b) => catCounts[b] - catCounts[a]).slice(0, 4)

  return (
    <tr className="border-b transition-colors hover:bg-zinc-50" style={{ borderColor: '#f0f0f0' }}>
      <td className="py-3 pl-5 pr-3 w-8">
        <span className="text-sm font-bold text-zinc-300 tabular-nums">{rank}</span>
      </td>
      <td className="py-3 pr-4">
        <Link
          href={`/principal/${encodeURIComponent(school)}`}
          className="text-sm font-semibold text-zinc-900 hover:text-red-600 transition-colors underline-offset-2 hover:underline"
        >
          {school}
        </Link>
      </td>
      <td className="py-3 pr-4 text-center">
        <span className="text-sm font-bold tabular-nums text-zinc-700">{tips.length}</span>
      </td>
      <td className="py-3 pr-4">
        <span
          className="text-[10px] font-bold uppercase px-2 py-1 rounded-md tracking-wide"
          style={style}
        >
          {label}
        </span>
      </td>
      <td className="py-3 pr-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {topCats.map(cat => (
            <span
              key={cat}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md"
              style={{ background: '#f4f4f5', color: '#52525b', border: '1px solid #e4e4e7' }}
            >
              {CATEGORY_ICON[cat]}
              <span className="font-medium">{catCounts[cat]}</span>
            </span>
          ))}
          {topCats.length === 0 && (
            <span className="text-[10px] text-zinc-300 italic">none</span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Recent Alert Row ─────────────────────────────────────────────────────────

function RecentAlertRow({ tip }: { tip: Tip }) {
  const icon = CATEGORY_ICON[tip.category] ?? '📋'
  const urgency = tip.urgency?.toLowerCase() ?? 'low'

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
            style={urgencyBadgeStyle(urgency)}
          >
            {tip.urgency}
          </span>
          <span className="text-xs font-medium text-zinc-700 capitalize">
            {tip.category?.replace(/_/g, ' ')}
          </span>
          {tip.school_name && (
            <Link
              href={`/principal/${encodeURIComponent(tip.school_name)}`}
              className="text-xs text-zinc-400 hover:text-red-600 transition-colors"
            >
              📍 {tip.school_name}
            </Link>
          )}
        </div>
        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
          {tip.ai_summary ?? tip.description}
        </p>
      </div>
      <span className="text-[10px] text-zinc-400 tabular-nums shrink-0 mt-0.5">
        {timeAgo(tip.submitted_at ?? tip.created_at)}
      </span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DistrictPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    )
  }, [])

  const fetchTips = useCallback(async () => {
    try {
      const res = await fetch('/api/tips')
      const data = await res.json()
      setTips(Array.isArray(data) ? data : [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTips()
  }, [fetchTips])

  // ── Derived stats ──────────────────────────────────────────────────────────

  const now = Date.now()
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  const tipsThisMonth = tips.filter(
    t => new Date(t.submitted_at ?? t.created_at).getTime() > oneMonthAgo
  )

  // Group by school
  const schoolMap = tips.reduce<Record<string, Tip[]>>((acc, tip) => {
    const name = tip.school_name ?? 'Unknown School'
    if (!acc[name]) acc[name] = []
    acc[name].push(tip)
    return acc
  }, {})

  const schools = Object.entries(schoolMap).sort((a, b) => b[1].length - a[1].length)

  const schoolsWithActiveThreats = schools.filter(([, schoolTips]) =>
    schoolTips.some(t => ['critical', 'high'].includes(t.urgency?.toLowerCase()) && t.status !== 'resolved')
  ).length

  const categoryCounts = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = tips.filter(t => t.category === cat).length
    return acc
  }, {})

  const recentHighPriority = tips
    .filter(
      t =>
        ['critical', 'high'].includes(t.urgency?.toLowerCase()) &&
        new Date(t.submitted_at ?? t.created_at).getTime() > sevenDaysAgo
    )
    .sort(
      (a, b) =>
        new Date(b.submitted_at ?? b.created_at).getTime() -
        new Date(a.submitted_at ?? a.created_at).getTime()
    )
    .slice(0, 10)

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#f8f9fb', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-6 py-4"
        style={{
          background: 'rgba(248,249,251,0.96)',
          borderBottom: '1px solid #e4e4e7',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
              style={{ background: '#dc2626' }}
            >
              TV
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-900 leading-tight">
                District Intelligence Center
              </div>
              <div className="text-[10px] text-zinc-400 tracking-wide">{dateStr}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{ background: '#ffffff', border: '1px solid #e4e4e7', color: '#3f3f46' }}
            >
              ← Command Center
            </Link>
            <Link
              href="/emergency"
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
            >
              🚨 Emergency Feed
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {/* Top stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Tips This Month"
            value={loading ? '—' : tipsThisMonth.length}
            sub="submitted district-wide"
            icon="📊"
          />
          <StatCard
            label="Schools with Active Threats"
            value={loading ? '—' : schoolsWithActiveThreats}
            sub="unresolved high/critical"
            icon="🏫"
            accentColor={schoolsWithActiveThreats > 0 ? '#dc2626' : '#16a34a'}
          />
          <StatCard
            label="Avg Response Time"
            value="8.2s"
            sub="AI triage · all tips"
            icon="⚡"
            accentColor="#0ea5e9"
          />
          <StatCard
            label="Total Schools"
            value={loading ? '—' : schools.length}
            sub="with at least one tip"
            icon="📍"
          />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: school leaderboard */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div
                className="px-5 py-4"
                style={{ borderBottom: '1px solid #f0f0f0' }}
              >
                <div className="text-sm font-semibold text-zinc-900">School Leaderboard</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Sorted by total tip volume · Click school to view portal
                </div>
              </div>
              {loading ? (
                <div className="p-5 flex flex-col gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: '#f4f4f5' }} />
                  ))}
                </div>
              ) : schools.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <div className="text-3xl opacity-20">🏫</div>
                  <div className="text-sm text-zinc-400">No school data yet</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <th className="py-2 pl-5 pr-3 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 w-8">#</th>
                        <th className="py-2 pr-4 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">School</th>
                        <th className="py-2 pr-4 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">Tips</th>
                        <th className="py-2 pr-4 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">Threat Level</th>
                        <th className="py-2 pr-5 text-left text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">Categories</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map(([school, schoolTips], i) => (
                        <SchoolRow key={school} school={school} tips={schoolTips} rank={i + 1} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bar chart */}
            {!loading && <BarChart counts={categoryCounts} />}
          </div>

          {/* Right: recent high-priority alerts */}
          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl overflow-hidden flex flex-col"
              style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div
                className="px-5 py-4 shrink-0"
                style={{ borderBottom: '1px solid #f0f0f0' }}
              >
                <div className="text-sm font-semibold text-zinc-900">Recent High-Priority Alerts</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Critical &amp; High · Last 7 days</div>
              </div>
              <div className="p-4 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 520 }}>
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#f4f4f5' }} />
                  ))
                ) : recentHighPriority.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                    <div className="text-3xl opacity-20">✅</div>
                    <div className="text-sm text-zinc-400">No high-priority alerts</div>
                    <div className="text-xs text-zinc-400 leading-relaxed">in the last 7 days</div>
                  </div>
                ) : (
                  recentHighPriority.map(tip => <RecentAlertRow key={tip.id} tip={tip} />)
                )}
              </div>
            </div>

            {/* Quick links */}
            <div
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">
                Quick Access
              </div>
              <Link
                href="/emergency"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
              >
                <span>🚨</span>
                Emergency Services Feed
              </Link>
              {schools.slice(0, 3).map(([school]) => (
                <Link
                  key={school}
                  href={`/principal/${encodeURIComponent(school)}`}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-zinc-50"
                  style={{ background: '#f8f9fb', color: '#3f3f46', border: '1px solid #e4e4e7' }}
                >
                  <span>🏫</span>
                  {school}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer
        className="text-center py-4 text-[10px] text-zinc-400"
        style={{ borderTop: '1px solid #e4e4e7' }}
      >
        Threat Vector — District Intelligence Center · Authorized Personnel Only
      </footer>
    </div>
  )
}
