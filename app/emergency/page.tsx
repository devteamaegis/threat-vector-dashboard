'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Tip } from '@/lib/supabase'

const REFRESH_INTERVAL_MS = 30_000

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const CATEGORY_ICON: Record<string, string> = {
  weapon: '🔫', bullying: '👊', drugs: '💊', threat: '⚠️',
  self_harm: '🚨', vandalism: '🔨', harassment: '📣', other: '📋',
}

function urgencyLabel(urgency: string): string {
  switch (urgency?.toLowerCase()) {
    case 'critical': return 'CRITICAL — LEVEL 5'
    case 'high':     return 'HIGH — LEVEL 4'
    default:         return urgency?.toUpperCase() ?? 'UNKNOWN'
  }
}

function urgencyStyle(urgency: string): React.CSSProperties {
  if (urgency?.toLowerCase() === 'critical') {
    return { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }
  }
  return { background: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74' }
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
      style={
        copied
          ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
          : { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }
      }
    >
      {copied ? '✓ Copied to Clipboard' : '📋 Copy Dispatch Brief'}
    </button>
  )
}

// ─── Emergency Card ───────────────────────────────────────────────────────────

function EmergencyCard({ tip }: { tip: Tip }) {
  const urgency = tip.urgency?.toLowerCase() ?? 'high'
  const icon = CATEGORY_ICON[tip.category] ?? '⚠️'
  const isCritical = urgency === 'critical'

  const dispatchText =
    tip.dispatch_brief ??
    [
      `THREAT VECTOR ALERT`,
      `School: ${tip.school_name ?? 'Unknown'}`,
      `Threat Type: ${tip.category?.toUpperCase() ?? 'UNKNOWN'}`,
      tip.location_detail ? `Location: ${tip.location_detail}` : null,
      tip.subject_description ? `Subject: ${tip.subject_description}` : null,
      `Urgency: ${urgencyLabel(urgency)}`,
      tip.ai_summary ? `Summary: ${tip.ai_summary}` : null,
      `Reported: ${new Date(tip.submitted_at ?? tip.created_at).toLocaleString()}`,
    ]
      .filter(Boolean)
      .join('\n')

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#ffffff',
        border: `2px solid ${isCritical ? '#ef4444' : '#f97316'}`,
        boxShadow: isCritical
          ? '0 4px 24px rgba(239,68,68,0.12)'
          : '0 4px 16px rgba(249,115,22,0.08)',
      }}
    >
      {/* Card header band */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{
          background: isCritical ? '#fef2f2' : '#fff7ed',
          borderBottom: `1px solid ${isCritical ? '#fecaca' : '#fed7aa'}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div
              className="text-sm font-black uppercase tracking-wider"
              style={{ color: isCritical ? '#b91c1c' : '#c2410c' }}
            >
              {urgencyLabel(urgency)}
            </div>
            <div className="text-xs font-medium text-zinc-500 mt-0.5">
              {formatTime(tip.submitted_at ?? tip.created_at)} · {timeAgo(tip.submitted_at ?? tip.created_at)}
            </div>
          </div>
        </div>
        <span
          className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg tracking-widest"
          style={urgencyStyle(urgency)}
        >
          {urgency}
        </span>
      </div>

      {/* Card body */}
      <div className="p-5 flex flex-col gap-4">
        {/* School + type */}
        <div>
          <div className="text-2xl font-black text-zinc-900 leading-tight">
            {tip.school_name ?? 'Unknown School'}
          </div>
          <div className="text-base font-semibold text-zinc-500 mt-1 capitalize">
            {tip.category?.replace(/_/g, ' ')} threat
          </div>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {tip.location_detail && (
            <div
              className="rounded-lg p-3"
              style={{ background: '#f8f9fb', border: '1px solid #e4e4e7' }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">Location</div>
              <div className="text-sm font-medium text-zinc-800">{tip.location_detail}</div>
            </div>
          )}
          {tip.subject_description && (
            <div
              className="rounded-lg p-3"
              style={{ background: '#f8f9fb', border: '1px solid #e4e4e7' }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">Subject</div>
              <div className="text-sm font-medium text-zinc-800">{tip.subject_description}</div>
            </div>
          )}
        </div>

        {/* Timeline */}
        {tip.timeline && (
          <div
            className="rounded-lg px-4 py-3 flex items-center gap-2"
            style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
          >
            <span className="text-base">⏱</span>
            <span className="text-sm font-semibold text-amber-800 capitalize">
              Timeline: {tip.timeline.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {/* AI Summary */}
        {tip.ai_summary && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">
              AI Threat Summary
            </div>
            <p className="text-base text-zinc-700 leading-relaxed">{tip.ai_summary}</p>
          </div>
        )}

        {/* Dispatch brief */}
        <div
          className="rounded-xl p-4"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
        >
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-600 mb-3">
            Dispatch Brief
          </div>
          <pre className="text-sm text-zinc-700 font-mono whitespace-pre-wrap leading-relaxed mb-4">
            {dispatchText}
          </pre>
          <CopyButton text={dispatchText} />
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmergencyPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [tick, setTick] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL_MS / 1000)

  const fetchCritical = useCallback(async () => {
    try {
      const res = await fetch('/api/tips')
      const data = await res.json()
      const all: Tip[] = Array.isArray(data) ? data : []
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      const filtered = all.filter(t => {
        const isHighPriority = ['critical', 'high'].includes(t.urgency?.toLowerCase())
        const isRecent = new Date(t.submitted_at ?? t.created_at).getTime() > cutoff
        return isHighPriority && isRecent
      })
      // Sort: critical first, then by time
      filtered.sort((a, b) => {
        if (a.urgency === 'critical' && b.urgency !== 'critical') return -1
        if (b.urgency === 'critical' && a.urgency !== 'critical') return 1
        return new Date(b.submitted_at ?? b.created_at).getTime() - new Date(a.submitted_at ?? a.created_at).getTime()
      })
      setTips(filtered)
      setLastUpdated(new Date())
      setSecondsUntilRefresh(REFRESH_INTERVAL_MS / 1000)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCritical()
    const interval = setInterval(fetchCritical, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchCritical])

  // Countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh(s => (s <= 1 ? REFRESH_INTERVAL_MS / 1000 : s - 1))
    }, 1000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Force re-render for timeAgo
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(id)
  }, [])
  void tick

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#f8f9fb', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-6 py-3"
        style={{ background: '#7f1d1d', borderBottom: '4px solid #991b1b' }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: '#b91c1c' }}
            >
              TV
            </div>
            <div>
              <div className="text-base font-black text-white tracking-[0.08em] uppercase leading-tight">
                Emergency Services Feed
              </div>
              <div className="text-[10px] text-red-300 font-medium tracking-[0.15em] uppercase leading-none mt-0.5">
                Threat Vector — Critical &amp; High Priority · Last 24 Hours
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-bold text-green-300 uppercase tracking-wider">LIVE</span>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-red-300">Last updated</div>
              <div className="text-sm font-bold text-white tabular-nums">
                {lastUpdated.toLocaleTimeString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-red-300">Next refresh</div>
              <div className="text-sm font-bold text-white tabular-nums">
                {secondsUntilRefresh}s
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col gap-4">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-2xl animate-pulse"
                style={{ background: '#ffffff', border: '1px solid #e4e4e7' }}
              />
            ))}
          </div>
        ) : tips.length === 0 ? (
          <div
            className="rounded-2xl flex flex-col items-center justify-center py-20 gap-4 text-center"
            style={{ background: '#f0fdf4', border: '2px solid #bbf7d0' }}
          >
            <div className="text-6xl">✅</div>
            <div className="text-3xl font-black text-green-700">ALL CLEAR</div>
            <div className="text-lg font-semibold text-green-600">
              No critical threats in last 24 hours
            </div>
            <div className="text-sm text-green-500 mt-1">
              Feed auto-refreshes every 30 seconds · Last checked {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3 flex-wrap">
              <div
                className="px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide"
                style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
              >
                {tips.length} Active Alert{tips.length !== 1 ? 's' : ''}
              </div>
              <div className="text-sm text-zinc-500">
                {tips.filter(t => t.urgency === 'critical').length} critical ·{' '}
                {tips.filter(t => t.urgency === 'high').length} high
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {tips.map(tip => (
                <EmergencyCard key={tip.id} tip={tip} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer
        className="text-center py-4 text-[10px] text-zinc-400"
        style={{ borderTop: '1px solid #e4e4e7' }}
      >
        Threat Vector — Emergency Services View · Authorized Personnel Only · Anonymous &amp; Confidential
      </footer>
    </div>
  )
}
