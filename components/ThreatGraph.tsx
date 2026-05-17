'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Tip } from '@/lib/supabase'

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false })

type NodeKind = 'School' | 'Tip' | 'Category'

interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  urgency?: string
  count?: number
  tip?: Tip
  x?: number; y?: number; z?: number
}
interface GraphLink {
  source: string
  target: string
  kind: string
}
interface GraphData { nodes: GraphNode[]; links: GraphLink[] }

const URGENCY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#64748b',
}

const CATEGORY_COLOR: Record<string, string> = {
  weapon:     '#ef4444',
  bullying:   '#f97316',
  drugs:      '#a855f7',
  threat:     '#f59e0b',
  self_harm:  '#ec4899',
  vandalism:  '#6366f1',
  harassment: '#14b8a6',
  other:      '#475569',
}

function spreadNode(node: GraphNode, index: number): GraphNode {
  const angle = (index * 2.399963) % (Math.PI * 2)
  const radii: Record<NodeKind, number>  = { School: 220, Category: 140, Tip: 300 }
  const zRange: Record<NodeKind, number> = { School: 60,  Category: 40,  Tip: 120 }
  const base = radii[node.kind] ?? 200
  const zr   = zRange[node.kind] ?? 80
  return {
    ...node,
    x: Math.cos(angle) * (base + (Math.random() - 0.5) * 80),
    y: Math.sin(angle) * (base + (Math.random() - 0.5) * 80),
    z: (Math.random() - 0.5) * zr,
  }
}

function buildGraphData(tips: Tip[]): GraphData {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const schoolSet   = new Map<string, number>()
  const categorySet = new Map<string, number>()

  tips.forEach(tip => {
    if (tip.school_name) schoolSet.set(tip.school_name, (schoolSet.get(tip.school_name) ?? 0) + 1)
    if (tip.category)    categorySet.set(tip.category, (categorySet.get(tip.category) ?? 0) + 1)
  })

  schoolSet.forEach((count, name) => {
    nodes.push({ id: `school::${name}`, kind: 'School', label: name, count })
  })

  categorySet.forEach((count, cat) => {
    nodes.push({ id: `cat::${cat}`, kind: 'Category', label: cat, count })
  })

  tips.forEach(tip => {
    nodes.push({ id: tip.id, kind: 'Tip', label: tip.ai_summary?.slice(0, 60) ?? tip.description.slice(0, 60), urgency: tip.urgency, tip })
    if (tip.school_name) links.push({ source: tip.id, target: `school::${tip.school_name}`, kind: 'InSchool' })
    if (tip.category)    links.push({ source: tip.id, target: `cat::${tip.category}`, kind: 'InCategory' })
  })

  for (let i = 0; i < tips.length; i++) {
    for (let j = i + 1; j < tips.length; j++) {
      const a = tips[i], b = tips[j]
      if (a.school_name && a.school_name === b.school_name && a.category === b.category) {
        links.push({ source: a.id, target: b.id, kind: 'SimilarThreat' })
      }
    }
  }

  return { nodes: nodes.map((n, i) => spreadNode(n, i)), links }
}

// ─── Mini bar ────────────────────────────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

// ─── Consensus badge ─────────────────────────────────────────────────────────
function ConsensusBadge({ consensus }: { consensus: boolean | null | undefined }) {
  if (consensus == null) return null
  return (
    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
      style={consensus
        ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }
        : { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
      }>
      {consensus ? 'consensus' : 'divergent'}
    </span>
  )
}

// ─── Node Popup ───────────────────────────────────────────────────────────────
function NodePopup({ node, pos, onClose }: {
  node: GraphNode
  pos: { x: number; y: number }
  onClose: () => void
}) {
  const tip = node.tip
  const urgColor = tip ? (URGENCY_COLOR[tip.urgency] ?? '#64748b') : '#f59e0b'

  return (
    <div
      className="fixed z-50 rounded-xl overflow-hidden shadow-2xl pointer-events-auto"
      style={{
        left: Math.min(pos.x + 12, window.innerWidth - 320),
        top:  Math.min(pos.y + 12, window.innerHeight - 560),
        width: 310,
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'rgba(8,10,16,0.97)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(8,10,16,0.97)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: urgColor, boxShadow: `0 0 6px ${urgColor}` }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{node.kind}</span>
          {tip && <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ background: urgColor + '22', color: urgColor, border: `1px solid ${urgColor}33` }}>
            {tip.urgency}
          </span>}
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-sm leading-none">✕</button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Title */}
        <div className="text-sm font-semibold text-slate-200 leading-snug">{node.label}</div>

        {/* School / Category aggregate */}
        {node.kind === 'School' && (
          <div className="text-xs text-slate-500">{node.count} tip{node.count !== 1 ? 's' : ''} from this school</div>
        )}
        {node.kind === 'Category' && (
          <div className="text-xs text-slate-500">{node.count} tip{node.count !== 1 ? 's' : ''} in this category</div>
        )}

        {tip && <>
          {/* ── 3-Model Consensus row ── */}
          {(tip.gemini_level != null || tip.bayes_probability_pct != null || tip.three_model_consensus != null) && (
            <div className="rounded-lg p-2.5 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">3-Model Consensus</span>
                <ConsensusBadge consensus={tip.three_model_consensus} />
              </div>
              {/* Claude */}
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-600 w-14 shrink-0">Claude</span>
                <MiniBar pct={((tip.ai_score ?? tip.ai_triage_score ?? 3) / 5) * 100} color="#06b6d4" />
                <span className="text-cyan-400 font-mono font-bold w-6 text-right">{tip.ai_score ?? tip.ai_triage_score ?? '—'}</span>
              </div>
              {/* Gemini */}
              {tip.gemini_level != null && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-600 w-14 shrink-0">Gemini</span>
                  <MiniBar pct={(tip.gemini_level / 5) * 100} color="#4ade80" />
                  <span className="text-green-400 font-mono font-bold w-6 text-right">{tip.gemini_level}</span>
                </div>
              )}
              {/* Bayesian */}
              {tip.bayes_probability_pct != null && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-600 w-14 shrink-0">Bayesian</span>
                  <MiniBar pct={tip.bayes_probability_pct} color="#f59e0b" />
                  <span className="text-amber-400 font-mono font-bold w-6 text-right">{tip.bayes_probability_pct}%</span>
                </div>
              )}
            </div>
          )}

          {/* ── Bayesian top drivers ── */}
          {tip.bayes_top_drivers && tip.bayes_top_drivers.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">Bayesian Drivers</span>
              <div className="flex flex-wrap gap-1">
                {tip.bayes_top_drivers.slice(0, 5).map((d, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                    {d.keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Gemini reasoning ── */}
          {tip.gemini_reasoning && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">Gemini Reasoning</span>
              <p className="text-[10px] text-slate-400 leading-relaxed italic">{tip.gemini_reasoning.slice(0, 140)}{tip.gemini_reasoning.length > 140 ? '…' : ''}</p>
            </div>
          )}

          {/* ── Threat window ── */}
          {tip.threat_window && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">Window</span>
              <span className="text-[10px] font-semibold"
                style={{ color: tip.threat_window.includes('24h') || tip.threat_window.includes('immediate') ? '#ef4444' : '#f97316' }}>
                {tip.threat_window}
              </span>
            </div>
          )}

          {/* ── Cross-school alert ── */}
          {tip.cross_school_alert && (
            <div className="rounded-lg px-2.5 py-2 flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="text-red-400 text-[10px] font-bold">!</span>
              <p className="text-[10px] text-red-300 leading-relaxed">{tip.cross_school_alert.slice(0, 120)}</p>
            </div>
          )}

          {/* ── Dispatch brief ── */}
          {tip.dispatch_brief && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">Dispatch Brief</span>
              <p className="text-[10px] text-slate-400 leading-relaxed font-mono"
                style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {tip.dispatch_brief.slice(0, 200)}{tip.dispatch_brief.length > 200 ? '…' : ''}
              </p>
            </div>
          )}

          {/* ── Key facts ── */}
          {tip.key_facts && tip.key_facts.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">Key Facts</span>
              <ul className="flex flex-col gap-0.5">
                {tip.key_facts.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400">
                    <span className="text-slate-700 mt-0.5">›</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Caller signals ── */}
          {(tip.caller_emotion || tip.caller_tone || tip.escalation_risk) && (
            <div className="flex flex-wrap gap-2 text-[10px]">
              {tip.caller_emotion && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-600">Emotion:</span>
                  <span className="text-slate-300 capitalize">{tip.caller_emotion}</span>
                </div>
              )}
              {tip.caller_tone && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-600">Tone:</span>
                  <span className="text-slate-300 capitalize">{tip.caller_tone}</span>
                </div>
              )}
              {tip.escalation_risk && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-600">Escalation:</span>
                  <span className="capitalize font-semibold"
                    style={{ color: tip.escalation_risk === 'imminent' ? '#ef4444' : tip.escalation_risk === 'escalating' ? '#f97316' : '#4ade80' }}>
                    {tip.escalation_risk}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Multilingual ── */}
          {tip.multilingual_call && tip.caller_language && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-600">Language:</span>
              <span className="text-cyan-400">{tip.caller_language}</span>
              <span className="text-slate-600">· auto-translated</span>
            </div>
          )}

          {/* ── Location / subject ── */}
          {(tip.location_detail || tip.subject_description) && (
            <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
              {tip.location_detail && <span>· {tip.location_detail}</span>}
              {tip.subject_description && <span>· {tip.subject_description.slice(0, 80)}</span>}
            </div>
          )}

          {/* ── School ── */}
          {tip.school_name && (
            <div className="text-[10px] text-slate-600">· {tip.school_name}</div>
          )}

          {/* ── Recommended action ── */}
          {tip.ai_recommended_action && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">Action</span>
              <span className="text-[10px] text-slate-300 capitalize">{tip.ai_recommended_action.replace(/_/g, ' ')}</span>
            </div>
          )}

          {/* ── S3 archive ── */}
          {tip.s3_archive_uri && (
            <div className="text-[9px] text-slate-700 font-mono truncate">
              {tip.s3_archive_uri}
            </div>
          )}
        </>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { tips: Tip[]; freshIds?: Set<string> }

export default function ThreatGraph({ tips, freshIds = new Set() }: Props) {
  const graphRef = useRef<any>(null)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })

  const graphData = useMemo(() => buildGraphData(tips), [tips])

  const nodeThreeObject = useMemo(() => {
    return (node: GraphNode) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const THREE = require('three')
      const group = new THREE.Group()
      const isSchool   = node.kind === 'School'
      const isCategory = node.kind === 'Category'

      let geo: any
      if (isSchool) {
        geo = new THREE.SphereGeometry(Math.max(12, (node.count ?? 1) * 5), 16, 16)
      } else if (isCategory) {
        geo = new THREE.OctahedronGeometry(10, 0)
      } else {
        const r = node.urgency === 'critical' ? 9 : node.urgency === 'high' ? 7 : node.urgency === 'medium' ? 5 : 4
        geo = new THREE.SphereGeometry(r, 12, 12)
      }

      let color = 0x14b8a6
      if (isSchool) {
        color = 0xf59e0b
      } else if (isCategory) {
        const hex = CATEGORY_COLOR[node.label]
        color = hex ? parseInt(hex.replace('#', ''), 16) : 0x14b8a6
      } else if (node.urgency) {
        const hex = URGENCY_COLOR[node.urgency]
        color = hex ? parseInt(hex.replace('#', ''), 16) : 0x64748b
      }

      // Fresh/latest nodes are pink
      const isFresh = freshIds.has(node.id)
      if (isFresh) color = 0xec4899

      const mat = new THREE.MeshPhongMaterial({
        color, emissive: color, emissiveIntensity: 0.3,
        shininess: 90, transparent: true, opacity: 0.9,
      })
      group.add(new THREE.Mesh(geo, mat))

      // Glow for schools, critical, tips with cross-school alerts, and fresh nodes
      const hasCrossAlert = node.tip?.cross_school_alert
      if (isSchool || node.urgency === 'critical' || hasCrossAlert || isFresh) {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 64
        const ctx = canvas.getContext('2d')!
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
        const glowColor = isFresh ? 'rgba(236,72,153,' : isSchool ? 'rgba(245,158,11,' : hasCrossAlert ? 'rgba(239,68,68,' : 'rgba(239,68,68,'
        grad.addColorStop(0, glowColor + '0.7)')
        grad.addColorStop(1, glowColor + '0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 64, 64)
        const tex = new THREE.CanvasTexture(canvas)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
        const scale = isFresh ? 45 : isSchool ? Math.max(50, (node.count ?? 1) * 18) : hasCrossAlert ? 55 : 40
        sprite.scale.setScalar(scale)
        group.add(sprite)
      }

      // Ring for consensus nodes
      if (node.tip?.three_model_consensus) {
        const ringGeo = new THREE.RingGeometry(
          node.urgency === 'critical' ? 11 : node.urgency === 'high' ? 9 : 7,
          node.urgency === 'critical' ? 13 : node.urgency === 'high' ? 11 : 9,
          32
        )
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x4ade80, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
        })
        group.add(new THREE.Mesh(ringGeo, ringMat))
      }

      return group
    }
  }, [freshIds])

  useEffect(() => {
    const scene = graphRef.current?.scene()
    if (!scene) return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const THREE = require('three')
    scene.add(new THREE.AmbientLight(0x0a0f1a, 3))
    const key = new THREE.DirectionalLight(0x06b6d4, 2.5)
    key.position.set(200, 300, 200)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xef4444, 1.2)
    fill.position.set(-200, -100, 100)
    scene.add(fill)
  }, [])

  const linkColor   = (l: GraphLink) => l.kind === 'SimilarThreat' ? '#f97316' : l.kind === 'InSchool' ? '#f59e0b' : '#14b8a6'
  const linkWidth   = (l: GraphLink) => l.kind === 'SimilarThreat' ? 1.5 : 0.6
  const linkOpacity = (l: GraphLink) => l.kind === 'SimilarThreat' ? 0.7 : 0.25

  function handleNodeClick(node: GraphNode, event: MouseEvent) {
    setSelected(node)
    setPopupPos({ x: event.clientX, y: event.clientY })
    if (graphRef.current && node.x != null) {
      graphRef.current.cameraPosition(
        { x: node.x, y: node.y, z: (node.z ?? 0) + 200 },
        { x: node.x, y: node.y, z: node.z ?? 0 },
        600
      )
    }
  }

  const isEmpty = tips.length === 0
  const criticalCount = tips.filter(t => t.urgency === 'critical').length
  const crossSchoolCount = tips.filter(t => t.cross_school_alert).length
  const consensusCount = tips.filter(t => t.three_model_consensus).length

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center" style={{ background: '#06080d' }}>

      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-10">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-slate-800">
            <circle cx="12" cy="12" r="2" /><circle cx="4" cy="6" r="2" /><circle cx="20" cy="6" r="2" /><circle cx="4" cy="18" r="2" /><circle cx="20" cy="18" r="2" />
            <line x1="6" y1="6" x2="10" y2="11" /><line x1="18" y1="6" x2="14" y2="11" /><line x1="6" y1="18" x2="10" y2="13" /><line x1="18" y1="18" x2="14" y2="13" />
          </svg>
          <div className="text-xs text-slate-700">No tips yet — graph builds as calls come in</div>
          <div className="text-[10px] text-slate-800">Call +1 (240) 266-5263 to create a threat report</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-3 rounded-xl"
        style={{ background: 'rgba(6,8,13,0.9)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-1">Graph Legend</div>
        {[
          { color: '#ec4899', label: 'Latest Threat',    shape: '●' },
          { color: '#f59e0b', label: 'School',           shape: '●' },
          { color: '#14b8a6', label: 'Category',         shape: '◆' },
          { color: '#ef4444', label: 'Critical Tip',     shape: '●' },
          { color: '#f97316', label: 'High Tip',         shape: '●' },
          { color: '#eab308', label: 'Medium Tip',       shape: '●' },
          { color: '#4ade80', label: 'Consensus Ring',   shape: '○' },
          { color: '#f97316', label: 'Similar Threats',  shape: '—' },
          { color: '#14b8a6', label: 'Category Link',    shape: '—' },
        ].map(({ color, label, shape }) => (
          <div key={label} className="flex items-center gap-2">
            <span style={{ color, fontSize: shape === '—' ? 14 : 10 }}>{shape}</span>
            <span className="text-[9px] text-slate-500">{label}</span>
          </div>
        ))}
        <div className="mt-1 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="text-[8px] text-slate-700 leading-relaxed">
            Click any node to inspect<br />
            pipeline data • drag to explore
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 z-10 flex gap-4 p-3 rounded-xl"
        style={{ background: 'rgba(6,8,13,0.9)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
        <div className="text-center">
          <div className="text-lg font-black text-slate-200 tabular-nums">{tips.length}</div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wide">tips</div>
        </div>
        <div className="w-px bg-slate-800" />
        <div className="text-center">
          <div className="text-lg font-black tabular-nums" style={{ color: criticalCount > 0 ? '#ef4444' : '#475569' }}>{criticalCount}</div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wide">critical</div>
        </div>
        <div className="w-px bg-slate-800" />
        <div className="text-center">
          <div className="text-lg font-black text-amber-400 tabular-nums">
            {new Set(tips.map(t => t.school_name).filter(Boolean)).size}
          </div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wide">schools</div>
        </div>
        {crossSchoolCount > 0 && <>
          <div className="w-px bg-slate-800" />
          <div className="text-center">
            <div className="text-lg font-black text-red-500 tabular-nums">{crossSchoolCount}</div>
            <div className="text-[9px] text-slate-600 uppercase tracking-wide">x-school</div>
          </div>
        </>}
        {consensusCount > 0 && <>
          <div className="w-px bg-slate-800" />
          <div className="text-center">
            <div className="text-lg font-black text-green-400 tabular-nums">{consensusCount}</div>
            <div className="text-[9px] text-slate-600 uppercase tracking-wide">consensus</div>
          </div>
        </>}
        {freshIds.size > 0 && <>
          <div className="w-px bg-slate-800" />
          <div className="text-center">
            <div className="text-lg font-black tabular-nums" style={{ color: '#ec4899' }}>{freshIds.size}</div>
            <div className="text-[9px] text-slate-600 uppercase tracking-wide">new</div>
          </div>
        </>}
      </div>

      {/* 3D Graph */}
      {!isEmpty && (
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData as any}
          nodeThreeObject={nodeThreeObject as any}
          nodeThreeObjectExtend={false}
          linkColor={linkColor as any}
          linkWidth={linkWidth as any}
          linkOpacity={linkOpacity as any}
          linkDirectionalParticles={(l: any) => l.kind === 'SimilarThreat' ? 3 : 0}
          linkDirectionalParticleColor={() => '#f97316'}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleSpeed={0.003}
          onNodeClick={handleNodeClick as any}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={200}
          enableNodeDrag
          showNavInfo={false}
          width={typeof window !== 'undefined' ? window.innerWidth - 208 : 800}
          height={typeof window !== 'undefined' ? window.innerHeight - 90 : 600}
        />
      )}

      {/* Popup */}
      {selected && (
        <NodePopup node={selected} pos={popupPos} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
