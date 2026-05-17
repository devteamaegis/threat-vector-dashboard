'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// ── Word classification sets ───────────────────────────────────────────────────
const THREAT_WORDS = new Set([
  'gun','guns','weapon','weapons','knife','knives','bomb','bombs','shoot','shooting',
  'shot','kill','killing','killed','hurt','harm','harming','attack','attacking',
  'attacked','threat','threatening','threatened','violence','violent','die','dead',
  'death','fight','fighting','destroy','explode','explosion','blood','murder','stab',
  'fire','burn','destroy','hurt','assault',
])
const URGENT_WORDS = new Set([
  'tomorrow','today','tonight','now','soon','immediately','urgent','quickly',
  'planning','plan','going','will','about','next','morning','afternoon','evening',
  'right','before','this','week','hour',
])
const FEAR_WORDS = new Set([
  'scared','terrified','afraid','fear','worried','nervous','panic','please','help',
  'dangerous','serious','warning','everyone','kids','students','people','friends',
  'worried','concerned','safe','unsafe','hide',
])

function classifyWord(w: string): 'threat' | 'urgent' | 'fear' | 'neutral' {
  const lower = w.toLowerCase().replace(/[^a-z]/g, '')
  if (THREAT_WORDS.has(lower)) return 'threat'
  if (URGENT_WORDS.has(lower)) return 'urgent'
  if (FEAR_WORDS.has(lower)) return 'fear'
  return 'neutral'
}

// ── Box-Muller normal random ───────────────────────────────────────────────────
function normalRandom(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ThreatBreakdownProps {
  transcript: string
  bayesProbPct?: number | null
  bayesCiLow?: number | null
  bayesCiHigh?: number | null
  bayesDrivers?: Array<{ keyword: string; weight?: number }> | null
  threatLevel?: number | null
  callerEmotion?: string | null
  callerTone?: string | null
  threeModelConsensus?: boolean | null
  schoolName?: string | null
  onClose: () => void
}

type Phase = 'decode' | 'signals' | 'montecarlo' | 'verdict'

const PHASE_ORDER: Phase[] = ['decode', 'signals', 'montecarlo', 'verdict']
const PHASE_LABELS: Record<Phase, string> = {
  decode: 'Decode',
  signals: 'Signals',
  montecarlo: 'Monte Carlo',
  verdict: 'Verdict',
}

// ── Circular SVG gauge ─────────────────────────────────────────────────────────
function VerdictGauge({ pct, color }: { pct: number; color: string }) {
  const R = 68
  const circumference = 2 * Math.PI * R
  const sweep = circumference * 0.75
  const filled = (clamp(pct, 0, 100) / 100) * sweep
  return (
    <div className="relative flex items-center justify-center" style={{ width: 176, height: 176 }}>
      <svg width={176} height={176} viewBox="0 0 176 176" style={{ transform: 'rotate(135deg)', position: 'absolute' }}>
        <circle cx={88} cy={88} r={R} fill="none" strokeWidth={10}
          stroke="rgba(255,255,255,0.07)"
          strokeDasharray={`${sweep} ${circumference}`}
          strokeLinecap="round" />
        <circle cx={88} cy={88} r={R} fill="none" strokeWidth={10}
          stroke={color}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 50ms linear', filter: `drop-shadow(0 0 10px ${color}90)` }} />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="text-4xl font-black tabular-nums leading-none" style={{ color, textShadow: `0 0 20px ${color}60` }}>
          {Math.round(pct)}%
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 mt-1.5">Threat Prob.</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ThreatBreakdownModal({
  transcript,
  bayesProbPct,
  bayesCiLow,
  bayesCiHigh,
  bayesDrivers,
  threatLevel,
  callerEmotion,
  callerTone,
  threeModelConsensus,
  schoolName,
  onClose,
}: ThreatBreakdownProps) {
  // Fallback / mock values when backend data is absent
  const words     = transcript.split(/\s+/).filter(Boolean)
  const wordClasses = words.map(w => classifyWord(w))
  const threatCount = wordClasses.filter(c => c === 'threat').length
  const urgentCount = wordClasses.filter(c => c === 'urgent').length
  const fearCount   = wordClasses.filter(c => c === 'fear').length
  const rawScore    = Math.min(threatCount * 20 + urgentCount * 10 + fearCount * 8, 95)
  const probPct    = bayesProbPct  ?? Math.max(rawScore, 5)
  const ciLow      = bayesCiLow   ?? Math.max(probPct - 12, 0)
  const ciHigh     = bayesCiHigh  ?? Math.min(probPct + 14, 100)
  const drivers    = bayesDrivers ?? (
    words.filter(w => classifyWord(w) !== 'neutral')
      .map(w => ({ keyword: w.toLowerCase(), weight: classifyWord(w) === 'threat' ? 3.2 : 1.6 }))
      .slice(0, 5)
  )
  const level = threatLevel ?? (probPct > 80 ? 5 : probPct > 55 ? 4 : probPct > 30 ? 3 : probPct > 10 ? 2 : 1)
  const verdictColor = probPct > 50 ? '#ef4444' : probPct > 15 ? '#f97316' : '#22c55e'

  // ── Phase state ──────────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<Phase>('decode')
  const [revealedCount, setRevealed]  = useState(0)
  const [signalFill, setSignalFill]   = useState(0)  // 0-100
  const [mcProgress, setMcProgress]   = useState(0)  // 0-N samples shown
  const [verdictPct, setVerdictPct]   = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number | null>(null)

  const goToPhase = useCallback((p: Phase) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPhase(p)
  }, [])

  // ── Phase 1: word reveal ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'decode') return
    let i = 0
    const id = setInterval(() => {
      i++
      setRevealed(i)
      if (i >= words.length) {
        clearInterval(id)
        const t = setTimeout(() => setPhase('signals'), 700)
        return () => clearTimeout(t)
      }
    }, Math.max(60, Math.min(120, 3000 / words.length)))
    return () => clearInterval(id)
  }, [phase, words.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 2: signal bar fill ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'signals') return
    let v = 0
    const id = setInterval(() => {
      v = Math.min(v + 2.5, 100)
      setSignalFill(v)
      if (v >= 100) {
        clearInterval(id)
        setTimeout(() => setPhase('montecarlo'), 600)
      }
    }, 18)
    return () => clearInterval(id)
  }, [phase])

  // ── Phase 3: Monte Carlo canvas ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'montecarlo') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const DPR = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth || 760
    const cssH = 180
    canvas.width  = cssW  * DPR
    canvas.height = cssH * DPR
    ctx.scale(DPR, DPR)
    const W = cssW, H = cssH

    const N    = 600
    const std  = Math.max((ciHigh - ciLow) / 4, 5)
    const mean = probPct
    const samples = Array.from({ length: N }, () => clamp(normalRandom(mean, std), 0, 100))

    // pre-sort by bucket for stacking
    const BUCKETS = 60
    const stacks: number[][] = Array.from({ length: BUCKETS }, () => [])
    samples.forEach(s => {
      const b = Math.floor((s / 100) * (BUCKETS - 1))
      stacks[b].push(s)
    })

    const toX = (p: number) => (p / 100) * (W - 30) + 15

    let frame = 0
    const TOTAL = 100

    const animate = () => {
      ctx.clearRect(0, 0, W, H)
      const progress = Math.min(frame / TOTAL, 1)
      const shown    = Math.floor(progress * N)

      // Dots per stack
      const stacked: number[] = new Array(BUCKETS).fill(0)
      let drawn = 0
      for (let b = 0; b < BUCKETS && drawn < shown; b++) {
        for (let j = 0; j < stacks[b].length && drawn < shown; j++, drawn++) {
          const s  = stacks[b][j]
          const bx = toX(s)
          const by = H - 22 - stacked[b] * 3.5
          stacked[b]++

          const alpha = 0.55 + (s > 50 ? 0.2 : 0)
          const col   = s > 50 ? `rgba(239,68,68,${alpha})` : s > 15 ? `rgba(249,115,22,${alpha})` : `rgba(34,197,94,${alpha})`
          ctx.fillStyle = col
          ctx.beginPath()
          ctx.arc(bx, by, 2.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // CI band (fades in after 65%)
      if (progress > 0.65) {
        const a = (progress - 0.65) / 0.35
        ctx.save()
        ctx.globalAlpha = a * 0.12
        ctx.fillStyle = '#f59e0b'
        ctx.fillRect(toX(ciLow), 0, toX(ciHigh) - toX(ciLow), H)
        ctx.restore()
        // CI dashes
        ctx.save()
        ctx.globalAlpha = a * 0.5
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 4])
        ;[ciLow, ciHigh].forEach(p => {
          const x = toX(p)
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
        })
        ctx.setLineDash([])
        ctx.restore()
      }

      // Mean line (fades in after 82%)
      if (progress > 0.82) {
        const a = (progress - 0.82) / 0.18
        const mx = toX(mean)
        ctx.save()
        ctx.globalAlpha = a
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.shadowColor = '#ef4444'
        ctx.shadowBlur = 6
        ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke()
        ctx.restore()
      }

      // Axis labels
      ctx.fillStyle = 'rgba(113,113,122,0.7)'
      ctx.font = '10px monospace'
      ;[0, 25, 50, 75, 100].forEach(p => {
        const x = toX(p)
        ctx.fillText(`${p}%`, x - 6, H - 4)
      })

      setMcProgress(Math.min(shown, N))
      frame++
      if (frame <= TOTAL + 40) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setTimeout(() => setPhase('verdict'), 500)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [phase, probPct, ciLow, ciHigh]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 4: verdict count-up ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'verdict') return
    let v = 0
    const id = setInterval(() => {
      v = Math.min(v + probPct / 45, probPct)
      setVerdictPct(v)
      if (v >= probPct) clearInterval(id)
    }, 28)
    return () => clearInterval(id)
  }, [phase, probPct])

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const phaseIdx = PHASE_ORDER.indexOf(phase)

  return (
    <>
      <style>{`
        @keyframes wordPop {
          0%   { transform: scale(0.75) translateY(4px); opacity: 0 }
          70%  { transform: scale(1.08) translateY(-1px); opacity: 1 }
          100% { transform: scale(1) translateY(0); opacity: 1 }
        }
        @keyframes wordFade {
          from { opacity: 0; transform: translateY(3px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes barGrow {
          from { transform: scaleX(0) }
          to   { transform: scaleX(1) }
        }
        @keyframes levelGlow {
          0%, 100% { box-shadow: 0 0 12px var(--lc, #ef4444)40 }
          50%      { box-shadow: 0 0 24px var(--lc, #ef4444)80 }
        }
        @keyframes mcFadeIn {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes verdictIn {
          from { opacity: 0; transform: scale(0.88) }
          to   { opacity: 1; transform: scale(1) }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            background: 'rgba(6,8,13,0.99)',
            border: `1px solid ${verdictColor}30`,
            boxShadow: `0 0 120px ${verdictColor}12, 0 0 0 1px ${verdictColor}10`,
            maxHeight: '92vh',
          }}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 px-6 py-4 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(239,68,68,0.04)' }}>

            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-red-400">Threat Analysis</span>
              {schoolName && <span className="text-[10px] text-zinc-500 font-mono">· {schoolName}</span>}
            </div>

            {/* Phase progress */}
            <div className="flex items-center gap-1 ml-auto mr-4">
              {PHASE_ORDER.map((p, i) => {
                const done   = phaseIdx > i
                const active = phase === p
                return (
                  <div key={p} className="flex items-center gap-1">
                    <button
                      onClick={() => goToPhase(p)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-[0.15em] transition-all duration-300 ${
                        active ? 'text-red-400 border border-red-500/30' :
                        done   ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-700 hover:text-zinc-600'
                      }`}
                      style={{ background: active ? 'rgba(239,68,68,0.1)' : 'transparent' }}
                    >
                      {done && <span className="text-green-500 text-[8px]">✓</span>}
                      {active && <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />}
                      {PHASE_LABELS[p]}
                    </button>
                    {i < PHASE_ORDER.length - 1 && (
                      <span className={`text-[10px] mx-0.5 ${done ? 'text-zinc-600' : 'text-zinc-800'}`}>›</span>
                    )}
                  </div>
                )
              })}
            </div>

            <button onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-base shrink-0">
              ✕
            </button>
          </div>

          {/* ── Content ─────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* ════ PHASE 1: DECODE ═════════════════════════════════════════ */}
            {phase === 'decode' && (
              <div className="p-6 flex gap-6" style={{ animation: 'mcFadeIn 0.3s ease-out' }}>

                {/* Left: transcript word-by-word */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Decoding Transcript</div>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                    <div className="text-[9px] font-mono text-zinc-600">{revealedCount}/{words.length} words</div>
                  </div>
                  <div className="text-[13px] leading-9 flex flex-wrap gap-x-2 gap-y-1.5">
                    {words.map((word, i) => {
                      if (i >= revealedCount) return null
                      const cls = classifyWord(word)
                      const isLast = i === revealedCount - 1
                      const baseAnim = `${isLast && cls !== 'neutral' ? 'wordPop' : 'wordFade'} 0.22s cubic-bezier(0.34,1.4,0.64,1) both`
                      const styles: React.CSSProperties =
                        cls === 'threat' ? {
                          color: '#f87171', background: 'rgba(239,68,68,0.16)',
                          border: '1px solid rgba(239,68,68,0.35)', borderRadius: 6,
                          padding: '2px 8px', fontWeight: 800, animation: baseAnim,
                          boxShadow: isLast ? '0 0 12px rgba(239,68,68,0.35)' : 'none',
                        } :
                        cls === 'urgent' ? {
                          color: '#fbbf24', background: 'rgba(245,158,11,0.13)',
                          border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6,
                          padding: '2px 8px', fontWeight: 700, animation: baseAnim,
                        } :
                        cls === 'fear' ? {
                          color: '#fb923c', background: 'rgba(249,115,22,0.11)',
                          border: '1px solid rgba(249,115,22,0.2)', borderRadius: 6,
                          padding: '2px 7px', fontWeight: 600, animation: baseAnim,
                        } :
                        { color: '#71717a', animation: 'wordFade 0.15s ease-out' }
                      return <span key={i} style={styles}>{word}</span>
                    })}
                    {revealedCount < words.length && (
                      <span className="inline-block w-0.5 h-5 bg-cyan-400 animate-pulse align-middle ml-0.5" />
                    )}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-5 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {[
                      { label: 'Threat word', color: '#f87171', bg: 'rgba(239,68,68,0.16)' },
                      { label: 'Urgency', color: '#fbbf24', bg: 'rgba(245,158,11,0.13)' },
                      { label: 'Fear / distress', color: '#fb923c', bg: 'rgba(249,115,22,0.11)' },
                      { label: 'Neutral', color: '#71717a', bg: 'transparent' },
                    ].map(l => (
                      <span key={l.label} className="flex items-center gap-1.5 text-[9px]">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ color: l.color, background: l.bg, border: `1px solid ${l.color}30` }}>Aa</span>
                        <span className="text-zinc-500">{l.label}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: live signal counters */}
                <div className="w-52 shrink-0 flex flex-col gap-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-0">Signals Detected</div>

                  {[
                    { label: 'Threat words',  color: '#ef4444', count: wordClasses.slice(0, revealedCount).filter(c => c === 'threat').length, icon: '🔴' },
                    { label: 'Urgency words', color: '#f59e0b', count: wordClasses.slice(0, revealedCount).filter(c => c === 'urgent').length, icon: '🟡' },
                    { label: 'Fear markers',  color: '#f97316', count: wordClasses.slice(0, revealedCount).filter(c => c === 'fear').length,   icon: '🟠' },
                  ].map(({ label, color, count, icon }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color }}><span>{icon}</span>{label}</span>
                        <span className="text-sm font-black tabular-nums transition-all" style={{ color }}>{count}</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-200 origin-left"
                          style={{
                            width: `${Math.min(100, count * 22)}%`,
                            background: `linear-gradient(90deg, ${color}60, ${color})`,
                            boxShadow: count > 0 ? `0 0 8px ${color}50` : 'none',
                          }} />
                      </div>
                    </div>
                  ))}

                  {/* Running probability */}
                  <div className="rounded-xl p-4 mt-1" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">Est. Threat %</div>
                    <div className="text-3xl font-black tabular-nums transition-all" style={{ color: verdictColor }}>
                      {Math.min(
                        wordClasses.slice(0, revealedCount).filter(c => c === 'threat').length * 20 +
                        wordClasses.slice(0, revealedCount).filter(c => c === 'urgent').length * 9 +
                        wordClasses.slice(0, revealedCount).filter(c => c === 'fear').length * 6,
                        99
                      )}%
                    </div>
                    <div className="text-[9px] text-zinc-600 mt-0.5">preliminary — Bayesian next</div>
                  </div>

                  {(callerEmotion || callerTone) && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Caller State</div>
                      {callerEmotion && (
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-zinc-500">Emotion</span>
                          <span className="font-semibold text-orange-400 capitalize">{callerEmotion}</span>
                        </div>
                      )}
                      {callerTone && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-zinc-500">Tone</span>
                          <span className="font-semibold text-zinc-300 capitalize">{callerTone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ PHASE 2: SIGNALS ════════════════════════════════════════ */}
            {phase === 'signals' && (
              <div className="p-6" style={{ animation: 'mcFadeIn 0.3s ease-out' }}>
                <div className="flex items-center gap-2 mb-6">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Extracting Threat Signals</div>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    { label: 'Verbal Threat Indicators', value: threatCount, max: 5, color: '#ef4444', icon: '⚠️', desc: `${threatCount} explicit threat word${threatCount !== 1 ? 's' : ''} detected in transcript` },
                    { label: 'Urgency Markers',          value: urgentCount, max: 5, color: '#f59e0b', icon: '⏱',  desc: `${urgentCount} time-sensitive indicator${urgentCount !== 1 ? 's' : ''} found` },
                    { label: 'Fear / Distress Signals',  value: fearCount,   max: 5, color: '#f97316', icon: '😨', desc: `${fearCount} emotional distress signal${fearCount !== 1 ? 's' : ''} identified` },
                    {
                      label: 'Composite Signal Score',
                      value: Math.min(threatCount * 3 + urgentCount * 2 + fearCount, 10),
                      max: 10,
                      color: '#8b5cf6',
                      icon: '🧬',
                      desc: 'Weighted multi-factor threat index',
                    },
                  ].map(({ label, value, max, color, icon, desc }) => {
                    const pct = (value / max) * (signalFill / 100) * 100
                    return (
                      <div key={label} className="rounded-xl p-5 flex flex-col gap-3"
                        style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg shrink-0">{icon}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] leading-tight" style={{ color: `${color}cc` }}>{label}</span>
                          </div>
                          <span className="text-2xl font-black tabular-nums shrink-0" style={{ color }}>{value}</span>
                        </div>
                        <div>
                          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-full rounded-full transition-all duration-100 origin-left"
                              style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${color}50, ${color})`,
                                boxShadow: `0 0 10px ${color}60`,
                              }} />
                          </div>
                          <div className="mt-2 text-[9px] text-zinc-500">{desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Emotional context breakdown */}
                <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">Emotional Context Map</div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Aggression',   pct: Math.min(threatCount * 22 + 5, 100), color: '#ef4444' },
                      { label: 'Desperation',  pct: Math.min(fearCount * 18 + urgentCount * 10, 100), color: '#f97316' },
                      { label: 'Intent',       pct: Math.min((threatCount + urgentCount) * 15, 100), color: '#f59e0b' },
                    ].map(({ label, pct: barPct, color }) => {
                      const displayPct = barPct * (signalFill / 100)
                      return (
                        <div key={label} className="flex flex-col items-center gap-2">
                          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-full rounded-full transition-all duration-100"
                              style={{ width: `${displayPct}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
                          </div>
                          <div className="text-[10px] font-bold tabular-nums" style={{ color }}>{Math.round(displayPct)}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ════ PHASE 3: MONTE CARLO ═══════════════════════════════════ */}
            {phase === 'montecarlo' && (
              <div className="p-6" style={{ animation: 'mcFadeIn 0.3s ease-out' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Bayesian Monte Carlo Simulation</div>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-cyan-500 tabular-nums">{mcProgress.toLocaleString()} / 600 draws</span>
                  </div>
                </div>

                {/* Canvas */}
                <div className="rounded-xl overflow-hidden mb-4"
                  style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <canvas ref={canvasRef} style={{ width: '100%', height: 180, display: 'block' }} />
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 mb-5">
                  <span className="flex items-center gap-2 text-[9px] text-zinc-500">
                    <span className="w-8 h-0.5 rounded" style={{ background: '#ef4444' }} />
                    Mean: {probPct.toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-2 text-[9px] text-zinc-500">
                    <span className="w-8 h-3 rounded opacity-30" style={{ background: '#f59e0b' }} />
                    95% CI: {ciLow.toFixed(0)}–{ciHigh.toFixed(0)}%
                  </span>
                  <div className="flex items-center gap-4 ml-auto">
                    {[
                      { color: '#ef4444', label: '>50% threat' },
                      { color: '#f97316', label: '15–50%' },
                      { color: '#22c55e', label: '<15% low risk' },
                    ].map(l => (
                      <span key={l.label} className="flex items-center gap-1.5 text-[9px] text-zinc-500">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* What is Monte Carlo */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-500 mb-2">How It Works</div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { step: '①', label: 'Sample priors', desc: '600 simulations draw from Bayesian keyword probability distributions' },
                      { step: '②', label: 'Aggregate', desc: 'Samples cluster around the true posterior probability of threat' },
                      { step: '③', label: 'Confidence', desc: 'Central 95% of samples form the confidence interval around mean' },
                    ].map(({ step, label, desc }) => (
                      <div key={step} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-500 font-bold text-sm">{step}</span>
                          <span className="text-[10px] font-bold text-zinc-300">{label}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════ PHASE 4: VERDICT ════════════════════════════════════════ */}
            {phase === 'verdict' && (
              <div className="p-6" style={{ animation: 'verdictIn 0.4s cubic-bezier(0.34,1.2,0.64,1)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Threat Assessment Complete</div>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                  {threeModelConsensus && (
                    <span className="text-[9px] font-bold uppercase px-3 py-1 rounded-full bg-green-950/50 border border-green-800/30 text-green-400">
                      ✓ 3-model consensus
                    </span>
                  )}
                </div>

                <div className="flex gap-8 items-start">
                  {/* Circular gauge */}
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <VerdictGauge pct={verdictPct} color={verdictColor} />
                    {(callerEmotion || callerTone) && (
                      <div className="text-center">
                        {callerEmotion && <div className="text-[10px] font-semibold capitalize" style={{ color: '#f97316' }}>{callerEmotion}</div>}
                        {callerTone    && <div className="text-[9px] text-zinc-500 capitalize">{callerTone}</div>}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-4">
                    {/* Threat level */}
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2.5">Threat Level</div>
                      <div className="flex items-center gap-2">
                        {[1,2,3,4,5].map(l => {
                          const active = l === level
                          const filled = l <= level
                          const lc = l >= 4 ? '#ef4444' : l >= 3 ? '#f97316' : '#f59e0b'
                          return (
                            <div key={l} className="flex-1 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-500"
                              style={{
                                background: filled ? `${lc}25` : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${filled ? lc + '45' : 'rgba(255,255,255,0.06)'}`,
                                color: filled ? lc : '#3f3f46',
                                transform: active ? 'scale(1.1)' : 'scale(1)',
                                boxShadow: active ? `0 0 20px ${lc}50` : 'none',
                                animation: active ? `levelGlow 1.5s ease-in-out infinite` : 'none',
                                // @ts-ignore
                                '--lc': lc,
                              }}>
                              {l}
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-between mt-1.5 px-1">
                        <span className="text-[8px] text-zinc-700">Low</span>
                        <span className="text-[8px] text-zinc-700">Critical</span>
                      </div>
                    </div>

                    {/* CI strip */}
                    <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-yellow-600 mb-3">95% Confidence Interval</div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-yellow-300 tabular-nums">{ciLow.toFixed(0)}%</span>
                        <div className="flex-1 relative h-3 rounded-full overflow-visible" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <div className="absolute h-full rounded-full"
                            style={{
                              left: `${ciLow}%`, width: `${ciHigh - ciLow}%`,
                              background: 'linear-gradient(90deg, rgba(245,158,11,0.4), rgba(245,158,11,0.8))',
                              boxShadow: '0 0 6px rgba(245,158,11,0.4)',
                            }} />
                          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-red-500"
                            style={{ left: `${probPct}%`, boxShadow: '0 0 6px #ef4444' }} />
                        </div>
                        <span className="text-lg font-black text-yellow-300 tabular-nums">{ciHigh.toFixed(0)}%</span>
                      </div>
                      <div className="text-[9px] text-zinc-600 mt-1.5">Mean: {probPct.toFixed(1)}% · CI width: {(ciHigh - ciLow).toFixed(0)}pp</div>
                    </div>

                    {/* Top Bayesian drivers */}
                    {drivers.length > 0 && (
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2.5">Top Bayesian Drivers</div>
                        <div className="flex flex-wrap gap-1.5">
                          {drivers.slice(0, 8).map((d, i) => (
                            <span key={i} className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full"
                              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
                              {d.keyword}
                              {d.weight != null && (
                                <span className="text-[9px] font-mono text-zinc-500">×{typeof d.weight === 'number' ? d.weight.toFixed(1) : d.weight}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className="px-6 py-3 flex items-center justify-between shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
            <span className="text-[9px] text-zinc-700 font-mono">
              Kairos AI · Bayesian Monte Carlo · 600 simulations · 95% CI
            </span>
            <div className="flex items-center gap-3">
              {phase !== 'verdict' && (
                <button onClick={() => goToPhase('verdict')}
                  className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors">
                  Skip to verdict →
                </button>
              )}
              {phase === 'verdict' && (
                <button onClick={onClose}
                  className="text-[10px] font-bold uppercase tracking-widest px-5 py-1.5 rounded-lg transition-all"
                  style={{ background: `${verdictColor}15`, color: verdictColor, border: `1px solid ${verdictColor}35` }}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
