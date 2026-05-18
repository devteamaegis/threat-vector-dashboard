'use client'

import { useEffect, useState } from 'react'
import { IconDna } from '@/components/Icons'

interface Memory {
  id?: string
  content?: string
  metadata?: { school?: string; category?: string; urgency?: string; threat_level?: number; tip_id?: string }
  score?: number
  created_at?: string
}

// Lightweight panel showing Supermemory recalls for the currently focused school.
// If SUPERMEMORY_API_KEY is unset the API returns 500 — we render an explanatory
// "not configured" state so the demo still makes sense.
export default function SupermemoryPanel({ school }: { school?: string }) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchMemories() {
      setLoading(true); setErr(null)
      try {
        const url = school ? `/api/supermemory?school=${encodeURIComponent(school)}` : `/api/supermemory`
        const r = await fetch(url)
        const data = await r.json()
        if (cancelled) return
        if (!r.ok) { setErr(data.error ?? 'unavailable'); setMemories([]); return }
        // Supermemory's search response shape: { results: [{ content, metadata, score }] }
        const list: Memory[] = data.results ?? data.memories ?? data ?? []
        setMemories(Array.isArray(list) ? list : [])
      } catch (e) {
        if (!cancelled) setErr(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchMemories()
    return () => { cancelled = true }
  }, [school])

  return (
    <div className="rounded-2xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
          <IconDna size={14} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] font-bold">Supermemory</div>
          <div className="text-[11px] text-[var(--foreground-2)]">{school ? `Patterns at ${school}` : 'Recent cross-school patterns'}</div>
        </div>
      </div>

      {loading && <div className="text-[11px] text-[var(--muted)]">Recalling…</div>}

      {!loading && err && (
        <div className="text-[11px] text-[var(--muted)] leading-relaxed">
          <b className="text-amber-500 block mb-1">Not configured</b>
          Set <code className="bg-zinc-800/40 px-1 rounded">SUPERMEMORY_API_KEY</code> to recall per-school pattern memory. Until then, every tip is triaged in isolation — Supermemory is what gives the AI cross-session, cross-school awareness.
        </div>
      )}

      {!loading && !err && memories.length === 0 && (
        <div className="text-[11px] text-[var(--muted)]">No prior memories yet. Future tips at this school will be enriched with this context automatically.</div>
      )}

      {!loading && !err && memories.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {memories.slice(0, 8).map((m, i) => (
            <div key={i} className="p-2.5 rounded-lg text-[11px]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[var(--foreground)]">{m.metadata?.school ?? 'unknown'}</span>
                <span className="text-[9px] uppercase tracking-wider text-amber-500">{m.metadata?.category ?? ''}</span>
              </div>
              <div className="text-[var(--foreground-2)] line-clamp-2 leading-snug">{m.content?.slice(0, 160)}</div>
              {typeof m.score === 'number' && (
                <div className="text-[9px] text-[var(--muted-2)] mt-1">similarity {m.score.toFixed(2)}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 pt-3 text-[10px] text-[var(--muted-2)] leading-relaxed"
        style={{ borderTop: '1px solid var(--border)' }}>
        Why it matters: a single counsellor can't remember every prior tip across 20 schools and 4 semesters. Supermemory does. When a new tip arrives, the AI is asked <i>"have we seen this pattern before?"</i> before scoring — that prior is what separates a noisy report from a credible escalation.
      </p>
    </div>
  )
}
