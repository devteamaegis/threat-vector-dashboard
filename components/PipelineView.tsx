'use client'

import { useState, useEffect, useRef } from 'react'

// ── Node definitions ──────────────────────────────────────────────────────────

interface PipelineNode {
  id: string
  label: string
  sublabel: string
  icon: string
  layer: 'input' | 'ingest' | 'process' | 'enrich' | 'output'
  col: number   // column index (0-based)
  row: number   // row index within column (0-based)
  color: string
  sponsor?: string
  detail: string
  latency?: string
  prize?: string
}

const NODES: PipelineNode[] = [
  // ── INPUT ────────────────────────────────────────────────────────────────
  {
    id: 'caller',
    label: 'Anonymous Caller',
    sublabel: 'Any language · 70+',
    icon: '📞',
    layer: 'input',
    col: 0, row: 0,
    color: '#06b6d4',
    detail: 'Anyone can call the Threat Vector hotline anonymously. The caller is never identified — no name, no number. They can speak in any of 70+ languages and the system processes it natively.',
  },
  // ── INGEST ───────────────────────────────────────────────────────────────
  {
    id: 'agentphone',
    label: 'AgentPhone',
    sublabel: 'Voice AI · STT',
    icon: '🎙️',
    layer: 'ingest',
    col: 1, row: 0,
    color: '#06b6d4',
    sponsor: 'AgentPhone',
    latency: '<2s',
    detail: 'AgentPhone hosts the AI voice agent. It handles incoming calls, runs speech-to-text transcription in real time, and posts the completed transcript to the Threat Vector webhook endpoint.',
    prize: 'Best Use of AgentPhone',
  },
  // ── PROCESS ──────────────────────────────────────────────────────────────
  {
    id: 'gemini_live',
    label: 'Gemini Live',
    sublabel: 'Multilingual · Translate',
    icon: '🌐',
    layer: 'process',
    col: 2, row: 0,
    color: '#4285f4',
    sponsor: 'Google DeepMind',
    latency: '280ms',
    detail: 'Gemini 2.0 Flash Live API streams the transcript in real time. It detects the spoken language, provides a full English translation, and returns an initial threat level (1-5). The only school safety system that handles non-English callers natively.',
    prize: 'Best Use of Gemini',
  },
  {
    id: 'claude',
    label: 'Claude Sonnet',
    sublabel: 'Threat classify · Level 1-5',
    icon: '🧠',
    layer: 'process',
    col: 2, row: 1,
    color: '#f97316',
    sponsor: 'Anthropic',
    latency: '2.4s',
    detail: 'Claude performs deep semantic threat assessment: caller emotion analysis, credibility scoring, key-fact extraction, escalation risk classification, and a recommended action. Returns a structured JSON object.',
  },
  {
    id: 'gemini_verify',
    label: 'Gemini Flash',
    sublabel: 'Consensus verify · Second opinion',
    icon: '✦',
    layer: 'process',
    col: 2, row: 2,
    color: '#4285f4',
    sponsor: 'Google DeepMind',
    latency: '3.1s',
    detail: 'Gemini 2.5 Flash independently re-scores the threat without seeing Claude\'s answer. If both models agree within 1 level, a CONSENSUS is established — the higher level locks in as the final score. Divergence triggers a manual review flag.',
    prize: 'Best Use of Gemini',
  },
  {
    id: 'bayes',
    label: 'Bayesian Monte Carlo',
    sublabel: 'Probability · Confidence',
    icon: '📊',
    layer: 'process',
    col: 2, row: 3,
    color: '#8b5cf6',
    latency: '50ms',
    detail: 'A Bayesian network combines Claude\'s level, Gemini\'s level, confidence scores, and historical base rates. Monte Carlo sampling over 1000 iterations produces a probability distribution — the final threat score is the posterior mean.',
  },
  // ── ENRICH ───────────────────────────────────────────────────────────────
  {
    id: 'moss',
    label: 'Moss',
    sublabel: 'Semantic search · Context',
    icon: '🔍',
    layer: 'enrich',
    col: 3, row: 0,
    color: '#6366f1',
    sponsor: 'Moss',
    latency: '620ms',
    detail: 'Moss performs semantic vector search over the tip database to surface similar past threats. Returns top-K contextually related incidents to inform the AI assessment. Enables cross-school pattern detection.',
    prize: 'Best Use of Moss',
  },
  {
    id: 'supermemory',
    label: 'Supermemory',
    sublabel: 'Pattern memory · History',
    icon: '🧬',
    layer: 'enrich',
    col: 3, row: 1,
    color: '#f59e0b',
    sponsor: 'Supermemory',
    latency: '4.1s',
    detail: 'Supermemory persists structured memories about threat patterns, repeat schools, and behavioral escalations. The AI can recall "this school has had 3 weapon tips this semester" — enabling longitudinal threat tracking across sessions.',
    prize: 'Best Use of Supermemory',
  },
  {
    id: 'browseruse',
    label: 'Browser Use',
    sublabel: 'OSINT · Background check',
    icon: '🌍',
    layer: 'enrich',
    col: 3, row: 2,
    color: '#10b981',
    latency: '8s',
    detail: 'For Level 4-5 threats, Browser Use autonomously searches public social media and news sources for corroborating evidence — recent posts, local news, school incidents. Provides OSINT context without human involvement.',
    prize: 'Best Use of Browser Use ($3k)',
  },
  // ── OUTPUT ───────────────────────────────────────────────────────────────
  {
    id: 'supabase',
    label: 'Supabase',
    sublabel: 'Realtime DB · Dashboard',
    icon: '🗄️',
    layer: 'output',
    col: 4, row: 0,
    color: '#10b981',
    sponsor: 'Supabase',
    latency: '3.4s',
    detail: 'The full tip payload (25+ structured fields) is written to Supabase Postgres. Realtime subscriptions push the tip to the live dashboard instantly. Historical data powers the Threat Intelligence graph with 10,000 seeded nodes.',
  },
  {
    id: 'twilio',
    label: 'Twilio SMS',
    sublabel: 'Principal alert · Immediate',
    icon: '📱',
    layer: 'output',
    col: 4, row: 1,
    color: '#ef4444',
    latency: '4.6s',
    detail: 'For Level 3+ threats, Twilio immediately sends an SMS to the school principal with threat level, school name, caller emotion, and recommended action. First responder contact in under 5 seconds from call end.',
  },
  {
    id: 'agentmail',
    label: 'AgentMail',
    sublabel: 'Safety officer brief · Email',
    icon: '✉️',
    layer: 'output',
    col: 4, row: 2,
    color: '#8b5cf6',
    sponsor: 'AgentMail',
    latency: '5.2s',
    detail: 'AgentMail sends a structured intelligence brief to the district safety officer — formatted report with full transcript, AI analysis, confidence scores, supporting facts, and recommended next steps. Inbox: ishaan-3830@agentmail.to.',
    prize: 'Best Use of AgentMail',
  },
  {
    id: 'aws',
    label: 'AWS S3',
    sublabel: 'Immutable archive · Audit',
    icon: '☁️',
    layer: 'output',
    col: 4, row: 3,
    color: '#ff9900',
    latency: '3.7s',
    detail: 'Every call transcript is archived to AWS S3 as an immutable record. Bucket: threat-vector-calls. This satisfies compliance requirements — a permanent, tamper-proof log of every threat report, including the raw AI output.',
  },
  {
    id: 'sponge',
    label: 'Sponge',
    sublabel: 'Micropayments · Per-tip billing',
    icon: '💳',
    layer: 'output',
    col: 4, row: 4,
    color: '#14b8a6',
    sponsor: 'Sponge',
    latency: '5.8s',
    detail: 'Sponge handles per-tip micropayments from the school district. Each tip costs the district a fraction of a cent — pay-as-you-go safety infrastructure. No subscription, no upfront cost. Districts only pay for actual threats processed.',
    prize: 'Best Use of Sponge',
  },
]

// ── Layout math ───────────────────────────────────────────────────────────────

const COL_LABELS = ['INPUT', 'INGEST', 'PROCESSING', 'ENRICHMENT', 'OUTPUT']
const COL_COLORS = ['#06b6d4', '#06b6d4', '#4285f4', '#8b5cf6', '#10b981']

const COL_X = [80, 230, 420, 620, 820]   // px from left of SVG canvas
const ROW_Y_BASE = 60  // px top of first row
const ROW_H = 90       // px between rows
const NODE_W = 120
const NODE_H = 64

function nodeCenter(n: PipelineNode) {
  const x = COL_X[n.col]
  const y = ROW_Y_BASE + n.row * ROW_H
  return { cx: x + NODE_W / 2, cy: y + NODE_H / 2 }
}

// Edges: [from_id, to_id]
const EDGES: [string, string][] = [
  ['caller',       'agentphone'],
  ['agentphone',   'gemini_live'],
  ['agentphone',   'claude'],
  ['gemini_live',  'claude'],
  ['claude',       'gemini_verify'],
  ['claude',       'bayes'],
  ['gemini_verify','bayes'],
  ['agentphone',   'moss'],
  ['bayes',        'supabase'],
  ['bayes',        'twilio'],
  ['bayes',        'agentmail'],
  ['bayes',        'aws'],
  ['bayes',        'sponge'],
  ['moss',         'bayes'],
  ['supermemory',  'bayes'],
  ['browseruse',   'bayes'],
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function PipelineView() {
  const [selected, setSelected] = useState<PipelineNode | null>(null)
  const [tick, setTick] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  // Animate particle tick
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 100), 40)
    return () => clearInterval(id)
  }, [])

  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]))

  const SVG_W = 980
  const SVG_H = 500

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: 'var(--background)', minHeight: '100%' }}>

      {/* ── Info panel top-left ──────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-20 w-52 rounded-xl p-3 text-[10px] leading-relaxed"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold uppercase tracking-widest text-[9px] text-[var(--muted)]">Data Pipeline</span>
        </div>
        <p className="text-[var(--foreground-2)] mb-2">
          Anonymous caller → AI multi-model triage → real-time principal alert in <span className="text-cyan-400 font-bold">&lt;8s</span>.
        </p>
        <div className="space-y-1">
          {[
            { label: 'Models',    value: '3 AI models', color: '#4285f4' },
            { label: 'Consensus', value: 'Claude + Gemini + Bayes', color: '#f97316' },
            { label: 'Latency',   value: '< 8 seconds', color: '#10b981' },
            { label: 'Languages', value: '70+ supported', color: '#06b6d4' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between gap-1">
              <span className="text-[var(--muted)]">{r.label}</span>
              <span className="font-semibold" style={{ color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-[var(--muted-2)] text-[9px]">Click any node to explore</span>
        </div>
      </div>

      {/* ── Column labels ────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center pt-3 pb-0 px-4 ml-[215px]">
        {COL_LABELS.map((label, i) => (
          <div key={label}
            className="text-[9px] font-bold uppercase tracking-widest text-center"
            style={{
              width: i < COL_LABELS.length - 1 ? `${COL_X[i+1] - COL_X[i]}px` : '140px',
              color: COL_COLORS[i],
              opacity: 0.7,
            }}>
            {label}
          </div>
        ))}
      </div>

      {/* ── SVG canvas ───────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4">
        <svg
          ref={svgRef}
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="block mx-auto"
          style={{ minWidth: SVG_W }}
        >
          <defs>
            {/* Glow filters */}
            <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* Animated gradient for edges */}
            {EDGES.map(([from, to], i) => {
              const a = nodeMap[from]
              const b = nodeMap[to]
              if (!a || !b) return null
              const { cx: ax, cy: ay } = nodeCenter(a)
              const { cx: bx, cy: by } = nodeCenter(b)
              return (
                <linearGradient key={i} id={`eg-${i}`}
                  x1={ax} y1={ay} x2={bx} y2={by} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={a.color} stopOpacity="0.7"/>
                  <stop offset="100%" stopColor={b.color} stopOpacity="0.7"/>
                </linearGradient>
              )
            })}
          </defs>

          {/* ── Edges ─────────────────────────────────────────────────── */}
          {EDGES.map(([from, to], i) => {
            const a = nodeMap[from]
            const b = nodeMap[to]
            if (!a || !b) return null
            const { cx: ax, cy: ay } = nodeCenter(a)
            const { cx: bx, cy: by } = nodeCenter(b)
            // Bezier control points
            const mx = (ax + bx) / 2
            const d = `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`

            // Particle position along path (t = 0..1)
            const phase = (i * 13 + tick * 1.5) % 100 / 100
            const t = phase
            // Cubic bezier at t
            const pt = cubicBezierPoint(ax, ay, mx, ay, mx, by, bx, by, t)

            return (
              <g key={i}>
                {/* Base edge */}
                <path d={d} fill="none" stroke={`url(#eg-${i})`} strokeWidth="1.5" strokeOpacity="0.25" />
                {/* Animated particle */}
                <circle
                  cx={pt.x} cy={pt.y} r="2.5"
                  fill={b.color}
                  opacity="0.9"
                  filter="url(#glow-cyan)"
                />
              </g>
            )
          })}

          {/* ── Nodes ─────────────────────────────────────────────────── */}
          {NODES.map(node => {
            const { cx, cy } = nodeCenter(node)
            const x = cx - NODE_W / 2
            const y = cy - NODE_H / 2
            const isSelected = selected?.id === node.id
            return (
              <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(isSelected ? null : node)}>
                {/* Outer glow ring when selected */}
                {isSelected && (
                  <rect x={x - 4} y={y - 4} width={NODE_W + 8} height={NODE_H + 8}
                    rx="14" fill="none" stroke={node.color} strokeWidth="2" strokeOpacity="0.6"
                    filter="url(#glow-blue)"
                  />
                )}
                {/* Card background */}
                <rect x={x} y={y} width={NODE_W} height={NODE_H}
                  rx="10"
                  fill="var(--surface)"
                  stroke={isSelected ? node.color : 'var(--border)'}
                  strokeWidth={isSelected ? "1.5" : "1"}
                  strokeOpacity={isSelected ? "0.8" : "0.4"}
                />
                {/* Color top bar */}
                <rect x={x} y={y} width={NODE_W} height={4} rx="10"
                  fill={node.color} opacity="0.7"
                />
                <rect x={x} y={y + 2} width={NODE_W} height={2} fill={node.color} opacity="0.7" />

                {/* Icon */}
                <text x={x + 12} y={y + 26} fontSize="16" dominantBaseline="middle" textAnchor="start">{node.icon}</text>

                {/* Label */}
                <text x={x + 34} y={y + 22} fontSize="9.5" fontWeight="700" fill="var(--foreground)" dominantBaseline="middle">
                  {node.label}
                </text>
                {/* Sublabel */}
                <text x={x + 34} y={y + 35} fontSize="7.5" fill="var(--muted)" dominantBaseline="middle">
                  {node.sublabel}
                </text>

                {/* Latency badge */}
                {node.latency && (
                  <g>
                    <rect x={x + 6} y={y + NODE_H - 18} width={42} height={12} rx="4"
                      fill={node.color} opacity="0.15" />
                    <text x={x + 27} y={y + NODE_H - 12} fontSize="7" fontWeight="600" fill={node.color}
                      dominantBaseline="middle" textAnchor="middle">
                      {node.latency}
                    </text>
                  </g>
                )}

                {/* Sponsor badge */}
                {node.sponsor && (
                  <g>
                    <rect x={x + NODE_W - 52} y={y + NODE_H - 18} width={46} height={12} rx="4"
                      fill={node.color} opacity="0.12" />
                    <text x={x + NODE_W - 29} y={y + NODE_H - 12} fontSize="6.5" fontWeight="600" fill={node.color}
                      dominantBaseline="middle" textAnchor="middle" opacity="0.9">
                      {node.sponsor.length > 10 ? node.sponsor.slice(0,10) + '…' : node.sponsor}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {/* ── Detail card (floating) ────────────────────────────────────── */}
        {selected && (
          <DetailCard node={selected} onClose={() => setSelected(null)} />
        )}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-4 px-6 pb-3 pt-1 flex-wrap"
        style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[9px] uppercase tracking-widest text-[var(--muted)] font-bold">Layers:</span>
        {COL_LABELS.map((l, i) => (
          <span key={l} className="flex items-center gap-1 text-[9px] font-semibold">
            <span className="w-2 h-2 rounded-full" style={{ background: COL_COLORS[i] }} />
            <span style={{ color: COL_COLORS[i] }}>{l}</span>
          </span>
        ))}
        <span className="ml-auto text-[9px] text-[var(--muted-2)]">
          {NODES.filter(n => n.sponsor).length} sponsors · {NODES.filter(n => n.prize).length} prize tracks
        </span>
      </div>
    </div>
  )
}

// ── Detail card ───────────────────────────────────────────────────────────────

function DetailCard({ node, onClose }: { node: PipelineNode; onClose: () => void }) {
  return (
    <div
      className="absolute bottom-12 right-4 w-80 rounded-2xl p-4 z-30 shadow-2xl"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${node.color}40`,
        boxShadow: `0 0 24px ${node.color}20`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{node.icon}</span>
          <div>
            <div className="font-bold text-[var(--foreground)] text-sm">{node.label}</div>
            <div className="text-[10px] text-[var(--muted)]">{node.sublabel}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg leading-none mt-0.5">×</button>
      </div>

      {/* Color bar */}
      <div className="h-px mb-3" style={{ background: `linear-gradient(90deg, ${node.color}, transparent)` }} />

      <p className="text-[11px] leading-relaxed text-[var(--foreground-2)] mb-3">{node.detail}</p>

      <div className="flex flex-wrap gap-2">
        {node.latency && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${node.color}18`, color: node.color, border: `1px solid ${node.color}30` }}>
            ⏱ {node.latency}
          </span>
        )}
        {node.sponsor && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${node.color}18`, color: node.color, border: `1px solid ${node.color}30` }}>
            🏷 {node.sponsor}
          </span>
        )}
        {node.prize && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            🏆 {node.prize}
          </span>
        )}
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          {node.layer}
        </span>
      </div>
    </div>
  )
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function cubicBezierPoint(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number,
) {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3,
    y: mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3,
  }
}
