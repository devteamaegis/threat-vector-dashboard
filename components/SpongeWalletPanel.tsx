'use client'
import { useEffect, useState, useRef } from 'react'

interface SpongeTransaction {
  service: string
  amount: number
  label?: string
  icon?: string
  call_id?: string
  subject?: string
  tx_id?: string
  created_at?: string
}

interface SpongeData {
  balance: number
  transactions: SpongeTransaction[]
}

const SERVICE_META: Record<string, { icon: string; color: string; label: string }> = {
  'background-check-agent': { icon: '🕵️', color: '#14b8a6', label: 'Background Check' },
  'browser-use-osint':      { icon: '🔍', color: '#818cf8', label: 'OSINT Search'     },
  'twilio-sms':             { icon: '📱', color: '#34d399', label: 'SMS Alert'         },
  'agentmail-brief':        { icon: '✉️', color: '#60a5fa', label: 'Email Brief'       },
  'gemini-verify':          { icon: '✦',  color: '#f59e0b', label: 'Gemini Verify'     },
  'supermemory-store':      { icon: '🧬', color: '#a78bfa', label: 'Memory Store'      },
}

function formatAmount(n: number) {
  if (n < 0.01) return `${(n * 100).toFixed(1)}¢`
  return `$${n.toFixed(2)}`
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export default function SpongeWalletPanel() {
  const [data, setData] = useState<SpongeData | null>(null)
  const [prev, setPrev] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const knownTxIds = useRef<Set<string>>(new Set())
  const pollCount = useRef(0)

  const load = async () => {
    try {
      const r = await fetch('/api/sponge', { cache: 'no-store' })
      const fresh: SpongeData = await r.json()
      pollCount.current++

      setData(prev => {
        if (prev !== null && fresh.balance !== prev.balance) {
          setFlash(true)
          setTimeout(() => setFlash(false), 1200)
        }
        setPrev(prev?.balance ?? null)
        return fresh
      })

      // Detect new transactions
      if (pollCount.current > 1) {
        const incoming = fresh.transactions.filter(tx => {
          const key = tx.tx_id || `${tx.call_id}-${tx.service}-${tx.amount}`
          return !knownTxIds.current.has(key)
        })
        if (incoming.length > 0) {
          const ids = new Set(incoming.map(tx => tx.tx_id || `${tx.call_id}-${tx.service}-${tx.amount}`))
          setNewIds(ids)
          setTimeout(() => setNewIds(new Set()), 4000)
        }
      }

      fresh.transactions.forEach(tx => {
        const key = tx.tx_id || `${tx.call_id}-${tx.service}-${tx.amount}`
        knownTxIds.current.add(key)
      })
    } catch { /* silently ignore */ }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const totalSpend = data?.transactions.reduce((acc, tx) => acc + (tx.amount || 0), 0) ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-400">Sponge Agent Wallet</span>
          </div>
          <span className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Live · auto-refreshes 15s</span>
        </div>

        {/* Balance + stats row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Balance */}
          <div className="col-span-1 p-3 rounded-lg flex flex-col gap-1"
            style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)' }}>
            <div className="text-[9px] uppercase tracking-widest text-teal-400/70">Wallet Balance</div>
            <div className={`text-2xl font-black tabular-nums transition-all duration-500 ${flash ? 'text-teal-300 scale-110' : 'text-teal-400'}`}>
              {data != null ? `$${data.balance.toFixed(2)}` : '—'}
            </div>
            {prev != null && data != null && prev !== data.balance && (
              <div className={`text-[9px] font-semibold ${data.balance > prev ? 'text-red-400' : 'text-teal-300'}`}>
                {data.balance > prev ? '▼' : '▲'} ${Math.abs(data.balance - prev).toFixed(3)} since last check
              </div>
            )}
          </div>

          {/* Total spend */}
          <div className="p-3 rounded-lg flex flex-col gap-1"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <div className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Session Spend</div>
            <div className="text-xl font-bold tabular-nums text-[var(--foreground)]">
              {formatAmount(totalSpend)}
            </div>
            <div className="text-[9px] text-[var(--muted)]">{data?.transactions.length ?? 0} transactions</div>
          </div>

          {/* Per-call avg */}
          <div className="p-3 rounded-lg flex flex-col gap-1"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <div className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Avg per Call</div>
            <div className="text-xl font-bold tabular-nums text-[var(--foreground)]">
              {data && data.transactions.length > 0
                ? formatAmount(totalSpend / Math.max(1, new Set(data.transactions.map(t => t.call_id || 'x')).size))
                : '—'}
            </div>
            <div className="text-[9px] text-[var(--muted)]">
              {data ? new Set(data.transactions.map(t => t.call_id || 'x')).size : 0} calls
            </div>
          </div>
        </div>

        {/* Service breakdown bar */}
        {data && data.transactions.length > 0 && (
          <div className="mt-3">
            <div className="text-[8px] uppercase tracking-widest text-[var(--muted)] mb-1.5">Spend by service</div>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
              {Object.entries(
                data.transactions.reduce((acc, tx) => {
                  acc[tx.service] = (acc[tx.service] || 0) + tx.amount
                  return acc
                }, {} as Record<string, number>)
              ).map(([svc, amt]) => {
                const meta = SERVICE_META[svc]
                const pct = (amt / totalSpend) * 100
                return (
                  <div key={svc} style={{ width: `${pct}%`, background: meta?.color || '#6b7280' }}
                    title={`${meta?.label || svc}: ${formatAmount(amt)}`} />
                )
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {Object.entries(SERVICE_META)
                .filter(([svc]) => data.transactions.some(t => t.service === svc))
                .map(([svc, meta]) => (
                  <div key={svc} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                    <span className="text-[8px] text-[var(--muted)]">{meta.label}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Transaction feed */}
      <div className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-2">
        <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] mb-1 flex items-center gap-2">
          <span>Transaction Feed</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span>most recent first</span>
        </div>

        {!data && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-teal-400/30 border-t-teal-400 animate-spin" />
              <span className="text-[10px] text-[var(--muted)]">Loading wallet…</span>
            </div>
          </div>
        )}

        {data?.transactions.map((tx, i) => {
          const meta = SERVICE_META[tx.service] || { icon: '💰', color: '#6b7280', label: tx.service }
          const txKey = tx.tx_id || `${tx.call_id}-${tx.service}-${tx.amount}`
          const isNew = newIds.has(txKey)
          return (
            <div key={`${txKey}-${i}`}
              className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-500 ${isNew ? 'ring-1' : ''}`}
              style={{
                background: isNew ? `${meta.color}18` : 'rgba(255,255,255,0.025)',
                border: `1px solid ${isNew ? meta.color + '50' : 'rgba(255,255,255,0.06)'}`,
                outline: isNew ? `1px solid ${meta.color}60` : undefined,
              }}>
              {/* Icon */}
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0"
                style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}>
                {meta.icon}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[var(--foreground)]">{tx.label || meta.label}</span>
                  <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: meta.color }}>
                    −{formatAmount(tx.amount)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {tx.subject && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(20,184,166,0.1)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.2)' }}>
                      subject: {tx.subject}
                    </span>
                  )}
                  {tx.call_id && (
                    <span className="text-[9px] font-mono text-[var(--muted)]">
                      call {tx.call_id.slice(-6)}
                    </span>
                  )}
                  {tx.tx_id && tx.tx_id !== 'demo-receipt' && tx.tx_id !== 'demo' && (
                    <span className="text-[9px] font-mono text-[var(--muted)]">
                      tx:{tx.tx_id.slice(0, 8)}…
                    </span>
                  )}
                  {tx.tx_id === 'demo-receipt' && (
                    <span className="text-[8px] px-1 rounded"
                      style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                      demo mode
                    </span>
                  )}
                  {tx.created_at && (
                    <span className="text-[9px] text-[var(--muted)] ml-auto">{timeAgo(tx.created_at)}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {data && data.transactions.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-2xl">🕵️</span>
              <span className="text-[11px] text-[var(--muted)]">No transactions yet</span>
              <span className="text-[9px] text-[var(--muted)]">Payments appear here as the agent processes calls</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer — Sponge branding */}
      <div className="shrink-0 px-6 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid var(--border)', background: 'rgba(20,184,166,0.04)' }}>
        <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
        <span className="text-[9px] text-teal-500/70 uppercase tracking-widest font-semibold">Powered by Sponge</span>
        <span className="text-[8px] text-[var(--muted)] ml-auto">agent-to-agent micropayments · agent economy</span>
      </div>
    </div>
  )
}
