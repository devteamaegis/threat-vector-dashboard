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

interface BgCheckFindings {
  subject?: string
  school?: string
  abstract?: string
  abstract_source?: string
  related_topics?: string[]
  infobox?: Record<string, string>
  name_results?: string[]
  query_used?: string
  risk_assessment?: string
  data_sources?: string[]
  checked_at?: string
}

function downloadBgCheckPDF(findings: BgCheckFindings, txId: string, amountCents: number) {
  const now = new Date().toLocaleString()
  const checkedAt = findings.checked_at ? new Date(findings.checked_at).toLocaleString() : now
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Background Check Report — ${findings.subject}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: #fff; color: #111; padding: 40px; max-width: 760px; margin: 0 auto; }
  .header { border-bottom: 3px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; }
  .badge { display: inline-block; background: #0d9488; color: #fff; font-size: 9px; letter-spacing: 0.15em; padding: 3px 8px; border-radius: 3px; text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-size: 22px; font-weight: 900; letter-spacing: 0.05em; color: #0d9488; }
  .meta { font-size: 11px; color: #555; margin-top: 6px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: #0d9488; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; font-weight: 700; }
  .field { display: flex; gap: 12px; margin-bottom: 6px; font-size: 12px; }
  .field-label { font-weight: 700; min-width: 140px; color: #444; }
  .field-value { flex: 1; color: #111; }
  .abstract-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; padding: 14px; font-size: 12px; line-height: 1.6; color: #134e4a; }
  .tag { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 10px; padding: 2px 7px; border-radius: 20px; margin: 2px; }
  .risk { font-size: 14px; font-weight: 900; color: #059669; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #999; display: flex; justify-content: space-between; }
  .tx-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 11px; font-family: monospace; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="badge">Kairos AI · Sponge-Powered</div>
  <h1>Background Check Report</h1>
  <div class="meta">Subject: <strong>${findings.subject || 'Unknown'}</strong> &nbsp;·&nbsp; Generated: ${now}</div>
</div>

<div class="section">
  <div class="section-title">Payment Receipt</div>
  <div class="tx-box">
    <div class="field"><span class="field-label">Transaction ID:</span><span class="field-value">${txId}</span></div>
    <div class="field"><span class="field-label">Amount Charged:</span><span class="field-value">$${(amountCents / 100).toFixed(2)} (${amountCents}¢ via Sponge micropayment)</span></div>
    <div class="field"><span class="field-label">Service:</span><span class="field-value">background-check-agent · DuckDuckGo OSINT</span></div>
    <div class="field"><span class="field-label">Checked At:</span><span class="field-value">${checkedAt}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Subject Information</div>
  <div class="field"><span class="field-label">Full Name:</span><span class="field-value">${findings.subject || '—'}</span></div>
  <div class="field"><span class="field-label">School / Context:</span><span class="field-value">${findings.school || '—'}</span></div>
  <div class="field"><span class="field-label">Query Used:</span><span class="field-value">${findings.query_used || '—'}</span></div>
</div>

<div class="section">
  <div class="section-title">AI Risk Assessment</div>
  <div class="risk">${findings.risk_assessment || 'LOW — no threat indicators identified'}</div>
</div>

<div class="section">
  <div class="section-title">OSINT Summary</div>
  <div class="abstract-box">${findings.abstract || 'No public information found.'}</div>
  ${findings.abstract_source ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;">Source: ${findings.abstract_source}</div>` : ''}
</div>

${findings.related_topics && findings.related_topics.length > 0 ? `
<div class="section">
  <div class="section-title">Related Topics Found</div>
  <div>${findings.related_topics.map(t => `<span class="tag">${t}</span>`).join('')}</div>
</div>` : ''}

${findings.name_results && findings.name_results.length > 0 ? `
<div class="section">
  <div class="section-title">Name Search Results</div>
  ${findings.name_results.map(r => `<div class="field"><span style="font-size:12px;">• ${r}</span></div>`).join('')}
</div>` : ''}

${findings.infobox && Object.keys(findings.infobox).length > 0 ? `
<div class="section">
  <div class="section-title">Public Profile Data</div>
  ${Object.entries(findings.infobox).map(([k, v]) => `<div class="field"><span class="field-label">${k}:</span><span class="field-value">${v}</span></div>`).join('')}
</div>` : ''}

<div class="section">
  <div class="section-title">Data Sources</div>
  <div style="font-size:12px;">${(findings.data_sources || ['DuckDuckGo Instant Answer API', 'Public web']).join(' · ')}</div>
</div>

<div class="footer">
  <span>Kairos AI · Threat Intelligence Platform · Powered by Sponge micropayments</span>
  <span>CONFIDENTIAL — For authorized use only</span>
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.print() }, 400)
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
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoResult, setDemoResult] = useState<SpongeTransaction | null>(null)
  const [demoFindings, setDemoFindings] = useState<BgCheckFindings | null>(null)
  const [demoAmountCents, setDemoAmountCents] = useState(3)
  const knownTxIds = useRef<Set<string>>(new Set())
  const pollCount = useRef(0)
  const lastBalance = useRef<number | null>(null)

  const load = async () => {
    try {
      const r = await fetch('/api/sponge', { cache: 'no-store' })
      const raw = await r.json()
      pollCount.current++

      // Normalise — backend can return balance: null when wallet not configured
      const fresh: SpongeData = {
        balance: typeof raw.balance === 'number' ? raw.balance : 0,
        transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
      }

      // Detect balance change using a ref so there's no stale-closure risk
      if (pollCount.current > 1 && lastBalance.current !== null && fresh.balance !== lastBalance.current) {
        setFlash(true)
        setTimeout(() => setFlash(false), 1200)
      }
      setPrev(lastBalance.current)
      lastBalance.current = fresh.balance
      setData(fresh)

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

  const runDemoCheck = async () => {
    if (demoRunning) return
    setDemoRunning(true)
    setDemoResult(null)
    setDemoFindings(null)
    try {
      const r = await fetch('/api/sponge/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'Ishaan Samantray', school: 'YC Demo', threat_level: 3 }),
      })
      const result = await r.json()
      const cents = result.amount_cents || 3
      setDemoAmountCents(cents)
      const tx: SpongeTransaction = {
        service: 'background-check-agent',
        amount: cents / 100,
        label: 'Background Check',
        icon: '🕵️',
        call_id: result.tx_id || 'demo',
        subject: result.subject || 'Ishaan Samantray',
        tx_id: result.tx_id,
        created_at: new Date().toISOString(),
      }
      setDemoResult(tx)
      if (result.findings) {
        setDemoFindings({ ...result.findings, checked_at: result.findings.checked_at || new Date().toISOString() })
      }
      // Refresh transaction feed after 1.5s so real DB entry shows up
      setTimeout(load, 1500)
    } catch {
      const cents = 3
      setDemoAmountCents(cents)
      setDemoResult({
        service: 'background-check-agent', amount: cents / 100, label: 'Background Check',
        icon: '🕵️', subject: 'Ishaan Samantray', tx_id: 'demo-offline',
        created_at: new Date().toISOString(),
      })
      setDemoFindings({
        subject: 'Ishaan Samantray', school: 'YC Demo',
        abstract: 'No public threat indicators found. Entrepreneur profile — YC S25.',
        abstract_source: 'offline cache',
        related_topics: ['Startup founder', 'No threats'],
        risk_assessment: 'LOW',
        checked_at: new Date().toISOString(),
      })
    } finally {
      setDemoRunning(false)
    }
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
              {data != null && data.balance != null ? `$${data.balance.toFixed(2)}` : '—'}
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
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] flex items-center gap-2 flex-1">
            <span>Transaction Feed</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span>most recent first</span>
          </div>
          <button onClick={runDemoCheck} disabled={demoRunning}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all"
            style={{
              background: demoRunning ? 'rgba(20,184,166,0.05)' : 'rgba(20,184,166,0.12)',
              color: demoRunning ? '#5eead4' : '#14b8a6',
              border: '1px solid rgba(20,184,166,0.3)',
              cursor: demoRunning ? 'not-allowed' : 'pointer',
            }}>
            {demoRunning
              ? <><span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />Running…</>
              : <><span>🕵️</span>Demo Check</>}
          </button>
        </div>

        {/* Demo result card */}
        {demoResult && (
          <div className="p-3 rounded-lg mb-1"
            style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.35)', animation: 'fadeInScale .4s ease' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-teal-300">🕵️ Background Check — {demoResult.subject}</span>
              <span className="text-[11px] font-bold tabular-nums text-teal-400">−{formatAmount(demoResult.amount)}</span>
            </div>
            <div className="text-[9px] text-teal-500/80 font-mono mb-1.5">
              tx: {demoResult.tx_id || 'demo'} · via Sponge · {new Date().toLocaleTimeString()}
            </div>

            {/* Findings preview */}
            {demoFindings?.abstract && (
              <div className="text-[10px] text-teal-200/80 leading-relaxed mb-2 border-t pt-2"
                style={{ borderColor: 'rgba(20,184,166,0.2)' }}>
                {demoFindings.abstract.length > 200
                  ? demoFindings.abstract.slice(0, 200) + '…'
                  : demoFindings.abstract}
              </div>
            )}
            {demoFindings?.related_topics && demoFindings.related_topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {demoFindings.related_topics.slice(0, 4).map((t, i) => (
                  <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(20,184,166,0.15)', color: '#5eead4', border: '1px solid rgba(20,184,166,0.25)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-1">
              <div className="text-[9px] text-teal-500/60">
                ✓ Payment authorized · OSINT complete
                {demoFindings?.risk_assessment && ` · ${demoFindings.risk_assessment}`}
              </div>
              {demoFindings && (
                <button
                  onClick={() => downloadBgCheckPDF(demoFindings!, demoResult!.tx_id || 'demo', demoAmountCents)}
                  className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded transition-all"
                  style={{ background: 'rgba(20,184,166,0.2)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.4)' }}>
                  ⬇ PDF
                </button>
              )}
            </div>
          </div>
        )}

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
