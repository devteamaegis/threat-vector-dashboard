'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Tip } from '@/lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function urgencyBorderColor(urgency: string): string {
  switch (urgency?.toLowerCase()) {
    case 'critical': return '#ef4444'
    case 'high':     return '#f97316'
    case 'medium':   return '#eab308'
    default:         return '#d4d4d8'
  }
}

function urgencyBadgeStyle(urgency: string): React.CSSProperties {
  switch (urgency?.toLowerCase()) {
    case 'critical': return { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
    case 'high':     return { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }
    case 'medium':   return { background: '#fefce8', color: '#ca8a04', border: '1px solid #fef08a' }
    default:         return { background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }
  }
}

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status?.toLowerCase()) {
    case 'new':       return { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
    case 'reviewing': return { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
    case 'resolved':  return { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
    case 'dismissed': return { background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }
    default:          return { background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }
  }
}

const CATEGORY_ICON: Record<string, string> = {
  weapon: '🔫', bullying: '👊', drugs: '💊', threat: '⚠️',
  self_harm: '🚨', vandalism: '🔨', harassment: '📣', other: '📋',
}

// ─── Tip Row ──────────────────────────────────────────────────────────────────

function TipRow({ tip, onClick }: { tip: Tip; onClick: () => void }) {
  const urgency = tip.urgency?.toLowerCase() ?? 'low'
  const icon = CATEGORY_ICON[tip.category] ?? '📋'
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl transition-all duration-150 hover:shadow-md hover:-translate-y-[1px]"
      style={{
        background: '#ffffff',
        border: '1px solid #e4e4e7',
        borderLeft: `4px solid ${urgencyBorderColor(urgency)}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-lg shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
              style={urgencyBadgeStyle(urgency)}
            >
              {tip.urgency}
            </span>
            <span className="text-xs font-medium text-zinc-700 capitalize">
              {tip.category?.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] text-zinc-400">{timeAgo(tip.submitted_at ?? tip.created_at)}</span>
          </div>
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
            {tip.ai_summary ?? tip.description}
          </p>
        </div>
        <span
          className="shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md"
          style={statusBadgeStyle(tip.status)}
        >
          {tip.status}
        </span>
      </div>
    </button>
  )
}

// ─── Tip Drawer ───────────────────────────────────────────────────────────────

function TipDrawer({
  tip,
  onClose,
  onStatusUpdate,
}: {
  tip: Tip
  onClose: () => void
  onStatusUpdate: (id: string, status: string) => void
}) {
  const [updating, setUpdating] = useState(false)
  const [updated, setUpdated] = useState(false)
  const urgency = tip.urgency?.toLowerCase() ?? 'low'
  const icon = CATEGORY_ICON[tip.category] ?? '📋'

  const markReviewing = async () => {
    if (updating || updated) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/tips/${tip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reviewing' }),
      })
      if (res.ok) {
        setUpdated(true)
        onStatusUpdate(tip.id, 'reviewing')
      }
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.25)' }} />
      <div
        className="relative z-10 ml-auto h-full w-full max-w-lg flex flex-col overflow-y-auto"
        style={{ background: '#ffffff', borderLeft: '1px solid #e4e4e7' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ borderBottom: '1px solid #ebebeb', background: '#ffffff' }}
        >
          <div className="flex items-center gap-2">
            <span>{icon}</span>
            <span
              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
              style={urgencyBadgeStyle(urgency)}
            >
              {tip.urgency}
            </span>
            <span className="text-sm font-semibold text-zinc-900 capitalize">
              {tip.category?.replace(/_/g, ' ')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Meta */}
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-semibold uppercase px-2 py-1 rounded-md"
              style={statusBadgeStyle(tip.status)}
            >
              {updated ? 'reviewing' : tip.status}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {new Date(tip.submitted_at ?? tip.created_at).toLocaleString()}
            </span>
          </div>

          {/* AI Summary */}
          {tip.ai_summary && (
            <div
              className="rounded-xl p-4"
              style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-700 mb-2">
                AI Assessment
              </div>
              <p className="text-sm text-zinc-800 leading-relaxed">{tip.ai_summary}</p>
            </div>
          )}

          {/* Recommended Action */}
          {tip.ai_recommended_action && (
            <div
              className="rounded-xl p-4"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-600 mb-1">
                Recommended Action
              </div>
              <p className="text-sm text-red-700 font-semibold capitalize">
                {tip.ai_recommended_action.replace(/_/g, ' ')}
              </p>
            </div>
          )}

          {/* Key Facts */}
          {tip.key_facts && tip.key_facts.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">
                Key Facts
              </div>
              <div className="flex flex-col gap-1.5">
                {tip.key_facts.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                    <span className="text-zinc-400 mt-0.5 shrink-0">·</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {tip.timeline && (
            <div
              className="rounded-xl p-4"
              style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-700 mb-1">
                Timeline
              </div>
              <p className="text-sm text-amber-800 font-medium capitalize">
                {tip.timeline.replace(/_/g, ' ')}
              </p>
            </div>
          )}

          {/* Credibility signals */}
          {tip.credibility_signals && tip.credibility_signals.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">
                Credibility Signals
              </div>
              <div className="flex flex-col gap-1">
                {tip.credibility_signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                    <span className="text-green-600 mt-0.5 shrink-0">+</span>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">
              Caller Transcript
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">{tip.description}</p>
          </div>

          {/* Mark Reviewed button */}
          <button
            onClick={markReviewing}
            disabled={updating || updated || tip.status === 'reviewing' || tip.status === 'resolved'}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={
              updated || tip.status === 'reviewing'
                ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
                : tip.status === 'resolved'
                ? { background: '#f4f4f5', color: '#a1a1aa', border: '1px solid #e4e4e7', cursor: 'not-allowed' }
                : {
                    background: updating ? '#f4f4f5' : '#1e293b',
                    color: updating ? '#71717a' : '#ffffff',
                    border: '1px solid transparent',
                    cursor: updating ? 'wait' : 'pointer',
                  }
            }
          >
            {updating
              ? 'Updating…'
              : updated || tip.status === 'reviewing'
              ? '✓ Marked as Reviewing'
              : tip.status === 'resolved'
              ? 'Already Resolved'
              : 'Mark as Reviewing'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number | string
  sub?: string
  accent?: 'red' | 'green' | 'default'
}) {
  const accentColor =
    accent === 'red' ? '#ef4444' : accent === 'green' ? '#16a34a' : '#18181b'
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{label}</div>
      <div className="text-3xl font-black tabular-nums leading-none" style={{ color: accentColor }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
    </div>
  )
}

// ─── Main Portal ──────────────────────────────────────────────────────────────

export default function PrincipalPortal() {
  const params = useParams()
  const schoolParam = params.school as string
  const schoolName = decodeURIComponent(schoolParam ?? '')

  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Tip | null>(null)
  const [dateStr, setDateStr] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)

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
    setRefreshing(true)
    try {
      const res = await fetch('/api/tips')
      const data = await res.json()
      const all: Tip[] = Array.isArray(data) ? data : []
      const filtered = all.filter(t => t.school_name === schoolName)
      setTips(filtered)
      setLastRefresh(new Date())
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [schoolName])

  useEffect(() => {
    fetchTips()
  }, [fetchTips])

  const handleStatusUpdate = (id: string, status: string) => {
    setTips(prev => prev.map(t => (t.id === id ? { ...t, status } : t)))
    if (selected?.id === id) setSelected(prev => (prev ? { ...prev, status } : null))
  }

  const openCount = tips.filter(t => t.status === 'new').length
  const criticalCount = tips.filter(t => t.urgency === 'critical').length
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const resolvedThisWeek = tips.filter(
    t => t.status === 'resolved' && new Date(t.submitted_at ?? t.created_at).getTime() > oneWeekAgo
  ).length

  return (
    <>
      <div
        className="min-h-screen flex flex-col"
        style={{ background: '#f8f9fb', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-10 px-6 py-4"
          style={{ background: 'rgba(248,249,251,0.96)', borderBottom: '1px solid #e4e4e7', backdropFilter: 'blur(12px)' }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                style={{ background: '#dc2626' }}
              >
                TV
              </div>
              <div>
                <div className="text-lg font-bold text-zinc-900 leading-tight">{schoolName}</div>
                <div className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase">
                  Safety Dashboard
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">{dateStr}</span>
              <button
                onClick={fetchTips}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  color: refreshing ? '#a1a1aa' : '#3f3f46',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {refreshing ? (
                  <>
                    <span className="w-3 h-3 border border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    Refreshing…
                  </>
                ) : (
                  <>↻ Refresh</>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Open Tips" value={loading ? '—' : openCount} sub="awaiting review" accent={openCount > 0 ? 'red' : 'default'} />
            <StatCard label="Critical" value={loading ? '—' : criticalCount} sub="urgent action needed" accent={criticalCount > 0 ? 'red' : 'default'} />
            <StatCard label="Resolved This Week" value={loading ? '—' : resolvedThisWeek} sub="closed in last 7 days" accent="green" />
          </div>

          {/* Tips list */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e4e4e7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid #f0f0f0' }}
            >
              <div>
                <div className="text-sm font-semibold text-zinc-900">Safety Reports</div>
                {!loading && (
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {tips.length} total · last updated {lastRefresh.toLocaleTimeString()}
                  </div>
                )}
              </div>
              {!loading && tips.length > 0 && (
                <div className="text-xs text-zinc-400">
                  {tips.filter(t => t.status === 'new').length} unreviewed
                </div>
              )}
            </div>

            <div className="p-4 flex flex-col gap-2">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl animate-pulse"
                    style={{ background: '#f4f4f5' }}
                  />
                ))
              ) : tips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="text-4xl opacity-20">🛡️</div>
                  <div className="text-sm font-medium text-zinc-500">No reports for {schoolName}</div>
                  <div className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                    Safety tips submitted to your school will appear here in real time.
                  </div>
                </div>
              ) : (
                tips.map(tip => (
                  <TipRow key={tip.id} tip={tip} onClick={() => setSelected(tip)} />
                ))
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer
          className="text-center py-4 text-[10px] text-zinc-400"
          style={{ borderTop: '1px solid #e4e4e7' }}
        >
          Powered by Threat Vector AI · Anonymous &amp; Confidential
        </footer>
      </div>

      {selected && (
        <TipDrawer
          tip={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </>
  )
}
