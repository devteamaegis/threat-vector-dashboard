'use client'

import React, { useState, useEffect } from 'react'
import {
  IconMicrophone, IconPhone, IconGlobe, IconBrain, IconSparkle,
  IconBarChart, IconSearch, IconDna, IconCompass, IconDatabase,
  IconSms, IconMail, IconCloud, IconBolt,
} from '@/components/Icons'

// ── Node definitions ──────────────────────────────────────────────────────────

interface PipelineNode {
  id: string
  label: string
  sublabel: string
  icon: React.ReactNode
  layer: 'input' | 'ingest' | 'process' | 'enrich' | 'output'
  col: number
  row: number
  color: string
  sponsor?: string
  detail: string
  latency?: string
  prize?: string
}

const NODES: PipelineNode[] = [
  {
    id: 'caller', label: 'Anonymous Caller', sublabel: 'Any language · 70+', icon: <IconMicrophone size={18} />,
    layer: 'input', col: 0, row: 0, color: '#06b6d4',
    detail: 'Anyone calls the Kairos hotline anonymously. No name, no number. 70+ languages supported — processed natively by Gemini Live, no pre-translation.',
  },
  {
    id: 'agentphone', label: 'AgentPhone', sublabel: 'Voice AI · STT', icon: <IconPhone size={18} />,
    layer: 'ingest', col: 1, row: 0, color: '#06b6d4', sponsor: 'AgentPhone', latency: '<2s',
    detail: 'AgentPhone hosts the AI voice agent. Handles incoming calls, real-time speech-to-text, and POSTs the transcript to the Kairos webhook.',
    prize: 'Best Use of AgentPhone',
  },
  {
    id: 'gemini_live', label: 'Gemini Live', sublabel: 'Multilingual · Translate', icon: <IconGlobe size={18} />,
    layer: 'process', col: 2, row: 0, color: '#4285f4', sponsor: 'Google DeepMind', latency: '280ms',
    detail: 'Gemini 2.0 Flash Live API streams in real time. Detects language, provides English translation, returns initial threat level 1-5. First school safety platform handling non-English callers natively.',
    prize: 'Best Use of Gemini',
  },
  {
    id: 'claude', label: 'Claude Sonnet', sublabel: 'Threat classify · Level 1-5', icon: <IconBrain size={18} />,
    layer: 'process', col: 2, row: 1, color: '#f97316', sponsor: 'Anthropic', latency: '2.4s',
    detail: 'Deep semantic threat assessment: emotion analysis, credibility scoring, key-fact extraction, escalation risk, and recommended action. Returns structured JSON.',
  },
  {
    id: 'gemini_verify', label: 'Gemini Flash', sublabel: 'Consensus verify', icon: <IconSparkle size={18} />,
    layer: 'process', col: 2, row: 2, color: '#4285f4', sponsor: 'Google DeepMind', latency: '3.1s',
    detail: 'Independently re-scores without seeing Claude\'s answer. If both models agree within 1 level, CONSENSUS locks in the higher score. Divergence triggers manual review.',
    prize: 'Best Use of Gemini',
  },
  {
    id: 'bayes', label: 'Bayesian Monte Carlo', sublabel: 'Probability · Confidence', icon: <IconBarChart size={18} />,
    layer: 'process', col: 2, row: 3, color: '#8b5cf6', latency: '50ms',
    detail: 'Combines Claude + Gemini scores with confidence and historical base rates. 1000 Monte Carlo samples → posterior mean = final threat score.',
  },
  {
    id: 'moss', label: 'Moss', sublabel: 'Semantic search · Context', icon: <IconSearch size={18} />,
    layer: 'enrich', col: 3, row: 0, color: '#6366f1', sponsor: 'Moss', latency: '620ms',
    detail: 'Semantic vector search over past threats. Returns top-K similar incidents to inform AI assessment. Enables cross-school pattern detection.',
    prize: 'Best Use of Moss',
  },
  {
    id: 'supermemory', label: 'Supermemory', sublabel: 'Pattern memory · History', icon: <IconDna size={18} />,
    layer: 'enrich', col: 3, row: 1, color: '#f59e0b', sponsor: 'Supermemory', latency: '4.1s',
    detail: 'Persists structured memories about threat patterns and repeat schools. AI can recall "this school had 3 weapon tips this semester" across sessions.',
    prize: 'Best Use of Supermemory',
  },
  {
    id: 'browseruse', label: 'Browser Use', sublabel: 'OSINT · Background check', icon: <IconCompass size={18} />,
    layer: 'enrich', col: 3, row: 2, color: '#10b981', latency: '8s',
    detail: 'For Level 4-5 threats, autonomously searches public social media and local news for corroborating evidence. OSINT without human involvement.',
    prize: 'Best Use of Browser Use ($3k)',
  },
  {
    id: 'supabase', label: 'Supabase', sublabel: 'Realtime DB · Dashboard', icon: <IconDatabase size={18} />,
    layer: 'output', col: 4, row: 0, color: '#10b981', sponsor: 'Supabase', latency: '3.4s',
    detail: '25+ structured fields written to Postgres. Realtime subscriptions push to the live dashboard instantly. 10,000 seeded nodes power the Threat Intelligence graph.',
  },
  {
    id: 'twilio', label: 'Twilio SMS', sublabel: 'Principal alert · Immediate', icon: <IconSms size={18} />,
    layer: 'output', col: 4, row: 1, color: '#ef4444', latency: '4.6s',
    detail: 'For Level 3+ threats: immediate SMS to the principal with threat level, school name, emotion, and recommended action. First responder notified in <5s.',
  },
  {
    id: 'agentmail', label: 'AgentMail', sublabel: 'Safety officer brief', icon: <IconMail size={18} />,
    layer: 'output', col: 4, row: 2, color: '#8b5cf6', sponsor: 'AgentMail', latency: '5.2s',
    detail: 'Structured intelligence brief to district safety officer — full transcript, AI analysis, confidence scores, key facts, and next steps.',
    prize: 'Best Use of AgentMail',
  },
  {
    id: 'aws', label: 'AWS S3', sublabel: 'Immutable archive · Audit', icon: <IconCloud size={18} />,
    layer: 'output', col: 4, row: 3, color: '#ff9900', latency: '3.7s',
    detail: 'Every transcript archived to S3 as an immutable compliance record. Permanent, tamper-proof log of every threat including raw AI output.',
  },
  {
    id: 'sponge', label: 'Sponge', sublabel: 'Micropayments · Per-tip', icon: <IconBolt size={18} />,
    layer: 'output', col: 4, row: 4, color: '#14b8a6', sponsor: 'Sponge', latency: '5.8s',
    detail: 'Per-tip micropayments from the school district. Pay-as-you-go safety — districts only pay for actual threats processed, fractions of a cent each.',
    prize: 'Best Use of Sponge',
  },
]

// ── Layout constants ───────────────────────────────────────────────────────────
const NODE_W  = 190
const NODE_H  = 88
const COL_X   = [60, 310, 570, 840, 1100]
const ROW_H   = 108
const ROW_Y0  = 48
const SVG_W   = 1360
const SVG_H   = 540

const COL_LABELS = ['INPUT', 'INGEST', 'PROCESSING', 'ENRICHMENT', 'OUTPUT']
const COL_COLORS = ['#06b6d4', '#06b6d4', '#4285f4', '#8b5cf6', '#10b981']

const EDGES: [string, string][] = [
  ['caller', 'agentphone'],
  ['agentphone', 'gemini_live'],
  ['agentphone', 'claude'],
  ['gemini_live', 'claude'],
  ['claude', 'gemini_verify'],
  ['claude', 'bayes'],
  ['gemini_verify', 'bayes'],
  ['agentphone', 'moss'],
  ['bayes', 'supabase'],
  ['bayes', 'twilio'],
  ['bayes', 'agentmail'],
  ['bayes', 'aws'],
  ['bayes', 'sponge'],
  ['moss', 'bayes'],
  ['supermemory', 'bayes'],
  ['browseruse', 'bayes'],
]

function nodeCenter(n: PipelineNode) {
  return {
    cx: COL_X[n.col] + NODE_W / 2,
    cy: ROW_Y0 + n.row * ROW_H + NODE_H / 2,
  }
}

function bezierD(ax: number, ay: number, bx: number, by: number) {
  const mx = (ax + bx) / 2
  return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`
}

function cubicAt(ax: number, ay: number, mx: number, bx: number, bxe: number, by: number, t: number) {
  // cubic bezier: P0=ax,ay  P1=mx,ay  P2=mx,by  P3=bx,by
  const mt = 1 - t
  return {
    x: mt*mt*mt*ax + 3*mt*mt*t*mx + 3*mt*t*t*mx + t*t*t*bxe,
    y: mt*mt*mt*ay + 3*mt*mt*t*ay + 3*mt*t*t*by  + t*t*t*by,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PipelineView() {
  const [selected, setSelected] = useState<PipelineNode | null>(null)
  const [tick, setTick] = useState(0)
  const [showMath, setShowMath] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 120), 35)
    return () => clearInterval(id)
  }, [])

  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]))

  return (
    <div className="relative w-full h-full flex flex-col select-none"
      style={{ background: 'var(--background)' }}>

      {/* ── Info panel ────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 w-56 rounded-2xl p-4"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Data Pipeline</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--foreground-2)] mb-3">
          Anonymous caller → 3-model AI triage → principal SMS in{' '}
          <span className="text-cyan-400 font-bold">&lt;8s</span>
        </p>
        <div className="space-y-2">
          {[
            { label: 'Models',    value: '3 AI models',          color: '#4285f4' },
            { label: 'Consensus', value: 'Claude + Gemini + Bayes', color: '#f97316' },
            { label: 'Latency',   value: '< 8 seconds',          color: '#10b981' },
            { label: 'Languages', value: '70+ supported',         color: '#06b6d4' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--muted)]">{r.label}</span>
              <span className="text-[10px] font-semibold" style={{ color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-[9px] text-[var(--muted-2)]">Click any node to explore</span>
          <button onClick={() => setShowMath(v => !v)}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded transition-all"
            style={{
              background: showMath ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.06)',
              color: '#c084fc',
              border: '1px solid rgba(168,85,247,0.3)',
            }}>
            ∑ {showMath ? 'Hide' : 'The Math'}
          </button>
        </div>
      </div>

      {/* ── Math panel overlay ────────────────────────────────────────────── */}
      {showMath && (
        <div className="absolute inset-0 z-30 flex flex-col" style={{ background: 'var(--background)' }}>
          <div className="shrink-0 flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-black text-base">∑</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-300">The Math Behind the Triage</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
                style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                Bayesian Monte Carlo · 500 sims
              </span>
            </div>
            <button onClick={() => setShowMath(false)}
              className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none transition-colors">×</button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe src="/math" className="w-full h-full border-0" title="Kairos Math Demo" />
          </div>
        </div>
      )}

      {/* ── Column headers ────────────────────────────────────────────── */}
      <div className="shrink-0 pt-4 pb-1 px-0" style={{ marginLeft: 0 }}>
        <svg width={SVG_W} height={28} viewBox={`0 0 ${SVG_W} 28`} className="block mx-auto" style={{ minWidth: SVG_W }}>
          {COL_LABELS.map((label, i) => {
            const x = COL_X[i] + NODE_W / 2
            return (
              <g key={label}>
                <text x={x} y={18} textAnchor="middle" fontSize="10" fontWeight="800"
                  letterSpacing="3" fill={COL_COLORS[i]} opacity="0.75"
                  style={{ fontFamily: 'var(--font-roboto-slab), serif', textTransform: 'uppercase' }}>
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── SVG canvas ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto px-0">
        <svg
          width={SVG_W} height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="block mx-auto"
          style={{ minWidth: SVG_W }}
        >
          <defs>
            {/* Per-node radial gradients */}
            {NODES.map(n => {
              const { cx, cy } = nodeCenter(n)
              const id = `ng-${n.id}`
              return (
                <radialGradient key={id} id={id} cx="30%" cy="30%" r="80%">
                  <stop offset="0%" stopColor={n.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={n.color} stopOpacity="0.06" />
                </radialGradient>
              )
            })}

            {/* Edge gradients */}
            {EDGES.map(([fromId, toId], i) => {
              const a = nodeMap[fromId]; const b = nodeMap[toId]
              if (!a || !b) return null
              const { cx: ax, cy: ay } = nodeCenter(a)
              const { cx: bx, cy: by } = nodeCenter(b)
              return (
                <linearGradient key={`eg-${i}`} id={`eg-${i}`}
                  x1={ax} y1={ay} x2={bx} y2={by} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={a.color} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={b.color} stopOpacity="0.55" />
                </linearGradient>
              )
            })}

            {/* Glow filter */}
            <filter id="node-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="particle-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── Edges ──────────────────────────────────────────────── */}
          {EDGES.map(([fromId, toId], i) => {
            const a = nodeMap[fromId]; const b = nodeMap[toId]
            if (!a || !b) return null
            const { cx: ax, cy: ay } = nodeCenter(a)
            const { cx: bx, cy: by } = nodeCenter(b)
            const d = bezierD(ax, ay, bx, by)
            const mx = (ax + bx) / 2
            const phase = ((i * 17 + tick * 1.8) % 120) / 120
            const pt = cubicAt(ax, ay, mx, mx, bx, by, phase)
            return (
              <g key={i}>
                {/* Glow layer */}
                <path d={d} fill="none" stroke={`url(#eg-${i})`} strokeWidth="2.5"
                  strokeOpacity="0.18" filter="url(#edge-glow)" />
                {/* Crisp line */}
                <path d={d} fill="none" stroke={`url(#eg-${i})`} strokeWidth="1.5"
                  strokeOpacity="0.45" />
                {/* Particle */}
                <circle cx={pt.x} cy={pt.y} r="4" fill={b.color} opacity="0.95"
                  filter="url(#particle-glow)" />
                <circle cx={pt.x} cy={pt.y} r="2" fill="white" opacity="0.7" />
              </g>
            )
          })}

          {/* ── Nodes ──────────────────────────────────────────────── */}
          {NODES.map(node => {
            const x = COL_X[node.col]
            const y = ROW_Y0 + node.row * ROW_H
            const isSelected = selected?.id === node.id

            return (
              <g key={node.id} style={{ cursor: 'pointer' }}
                onClick={() => setSelected(isSelected ? null : node)}>

                {/* Outer selection glow */}
                {isSelected && (
                  <rect x={x - 6} y={y - 6} width={NODE_W + 12} height={NODE_H + 12}
                    rx="18" fill="none" stroke={node.color} strokeWidth="2"
                    strokeOpacity="0.5" filter="url(#node-glow)" />
                )}

                {/* Card shadow */}
                <rect x={x + 2} y={y + 4} width={NODE_W} height={NODE_H}
                  rx="14" fill="rgba(0,0,0,0.35)" />

                {/* Card base */}
                <rect x={x} y={y} width={NODE_W} height={NODE_H}
                  rx="14"
                  fill={`url(#ng-${node.id})`} />
                <rect x={x} y={y} width={NODE_W} height={NODE_H}
                  rx="14" fill="none"
                  stroke={isSelected ? node.color : node.color}
                  strokeWidth={isSelected ? '2' : '1'}
                  strokeOpacity={isSelected ? '0.85' : '0.3'} />

                {/* Top accent bar */}
                <rect x={x} y={y} width={NODE_W} height={5} rx="14"
                  fill={node.color} opacity="0.8" />
                <rect x={x} y={y + 3} width={NODE_W} height={2}
                  fill={node.color} opacity="0.5" />

                {/* Icon circle background */}
                <circle cx={x + 30} cy={y + NODE_H / 2} r="18"
                  fill={node.color} opacity="0.15" />
                <circle cx={x + 30} cy={y + NODE_H / 2} r="17"
                  fill="none" stroke={node.color} strokeWidth="1" strokeOpacity="0.3" />

                {/* Icon */}
                <foreignObject
                  x={x + 30 - 11}
                  y={y + NODE_H / 2 - 11}
                  width={22}
                  height={22}
                  style={{ overflow: 'visible' }}
                >
                  <div
                    style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: node.color }}
                  >
                    {node.icon}
                  </div>
                </foreignObject>

                {/* Label */}
                <text x={x + 56} y={y + 28} fontSize="11.5" fontWeight="700"
                  fill="var(--foreground)" dominantBaseline="middle"
                  style={{ fontFamily: 'var(--font-roboto-slab), serif' }}>
                  {node.label}
                </text>

                {/* Sublabel */}
                <text x={x + 56} y={y + 44} fontSize="9" fill="var(--muted)"
                  dominantBaseline="middle"
                  style={{ fontFamily: 'var(--font-roboto-slab), serif' }}>
                  {node.sublabel}
                </text>

                {/* Bottom badges row */}
                {node.latency && (
                  <g>
                    <rect x={x + 56} y={y + NODE_H - 22} width={46} height={15}
                      rx="5" fill={node.color} opacity="0.18" />
                    <rect x={x + 56} y={y + NODE_H - 22} width={46} height={15}
                      rx="5" fill="none" stroke={node.color} strokeWidth="0.8" strokeOpacity="0.35" />
                    <text x={x + 79} y={y + NODE_H - 14}
                      fontSize="8.5" fontWeight="700" fill={node.color}
                      dominantBaseline="middle" textAnchor="middle"
                      style={{ fontFamily: 'var(--font-roboto-slab), serif' }}>
                      ⏱ {node.latency}
                    </text>
                  </g>
                )}

                {node.sponsor && (
                  <g>
                    <rect x={x + 108} y={y + NODE_H - 22} width={NODE_W - 114} height={15}
                      rx="5" fill={node.color} opacity="0.12" />
                    <rect x={x + 108} y={y + NODE_H - 22} width={NODE_W - 114} height={15}
                      rx="5" fill="none" stroke={node.color} strokeWidth="0.8" strokeOpacity="0.25" />
                    <text x={x + 108 + (NODE_W - 114) / 2} y={y + NODE_H - 14}
                      fontSize="7.5" fontWeight="600" fill={node.color} opacity="0.9"
                      dominantBaseline="middle" textAnchor="middle"
                      style={{ fontFamily: 'var(--font-roboto-slab), serif' }}>
                      {node.sponsor.length > 10 ? node.sponsor.slice(0, 10) + '…' : node.sponsor}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Detail card ───────────────────────────────────────────────── */}
      {selected && (
        <DetailCard node={selected} onClose={() => setSelected(null)} />
      )}

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-5 px-6 py-2.5 flex-wrap"
        style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] font-bold">Layers:</span>
        {COL_LABELS.map((l, i) => (
          <span key={l} className="flex items-center gap-1.5 text-[10px] font-semibold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COL_COLORS[i] }} />
            <span style={{ color: COL_COLORS[i] }}>{l}</span>
          </span>
        ))}
        <span className="ml-auto text-[9px] text-[var(--muted-2)]">
          {NODES.filter(n => n.sponsor).length} integrations
        </span>
      </div>
    </div>
  )
}

// ── Detail card ───────────────────────────────────────────────────────────────

function DetailCard({ node, onClose }: { node: PipelineNode; onClose: () => void }) {
  return (
    <div
      className="absolute bottom-14 right-5 z-30 w-88 rounded-2xl overflow-hidden"
      style={{
        width: 340,
        background: 'var(--surface)',
        border: `1px solid ${node.color}50`,
        boxShadow: `0 0 0 1px ${node.color}20, 0 16px 48px rgba(0,0,0,0.35), 0 0 40px ${node.color}15`,
      }}>
      {/* Header bar */}
      <div className="px-5 py-4 flex items-start justify-between gap-3"
        style={{ background: `${node.color}12`, borderBottom: `1px solid ${node.color}25` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: `${node.color}20`, border: `1px solid ${node.color}35` }}>
            {node.icon}
          </div>
          <div>
            <div className="font-bold text-[var(--foreground)] text-sm leading-tight">{node.label}</div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">{node.sublabel}</div>
          </div>
        </div>
        <button onClick={onClose}
          className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl leading-none mt-0.5 shrink-0 transition-colors">×</button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-[12px] leading-relaxed text-[var(--foreground-2)] mb-4">{node.detail}</p>
        <div className="flex flex-wrap gap-2">
          {node.latency && (
            <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-semibold"
              style={{ background: `${node.color}15`, color: node.color, border: `1px solid ${node.color}30` }}>
              ⏱ {node.latency}
            </span>
          )}
          {node.sponsor && (
            <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-semibold"
              style={{ background: `${node.color}15`, color: node.color, border: `1px solid ${node.color}30` }}>
              🏷 {node.sponsor}
            </span>
          )}
          <span className="text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            {node.layer}
          </span>
        </div>
      </div>
    </div>
  )
}
