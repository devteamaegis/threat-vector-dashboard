'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Tip } from '@/lib/supabase'

// Dynamically import the 3D graph — it uses WebGL, can't SSR
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false })

// ─── Data model ──────────────────────────────────────────────────────────────

type NodeKind = 'School' | 'Tip' | 'Category' | 'Pattern'

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

// Golden-angle spread so nodes don't all spawn at origin
function spreadNode(node: GraphNode, index: number): GraphNode {
  const angle = (index * 2.399963) % (Math.PI * 2)
  const radii: Record<NodeKind, number>   = { School: 220, Category: 140, Tip: 300, Pattern: 180 }
  const zRange: Record<NodeKind, number>  = { School: 60,  Category: 40,  Tip: 120, Pattern: 60  }
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
  const schoolSet  = new Map<string, number>()
  const categorySet = new Map<string, number>()

  tips.forEach(tip => {
    if (tip.school_name) schoolSet.set(tip.school_name, (schoolSet.get(tip.school_name) ?? 0) + 1)
    if (tip.category)    categorySet.set(tip.category, (categorySet.get(tip.category) ?? 0) + 1)
  })

  // School nodes
  schoolSet.forEach((count, name) => {
    nodes.push({ id: `school::${name}`, kind: 'School', label: name, count })
  })

  // Category nodes
  categorySet.forEach((count, cat) => {
    nodes.push({ id: `cat::${cat}`, kind: 'Category', label: cat, count })
  })

  // Tip nodes
  tips.forEach(tip => {
    nodes.push({ id: tip.id, kind: 'Tip', label: tip.ai_summary?.slice(0,60) ?? tip.description.slice(0,60), urgency: tip.urgency, tip })
    if (tip.school_name) links.push({ source: tip.id, target: `school::${tip.school_name}`, kind: 'InSchool' })
    if (tip.category)    links.push({ source: tip.id, target: `cat::${tip.category}`, kind: 'InCategory' })
  })

  // Cross-tip similarity links (same school + same category)
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

// ─── Popup card ──────────────────────────────────────────────────────────────

function NodePopup({ node, pos, onClose }: {
  node: GraphNode
  pos: { x: number; y: number }
  onClose: () => void
}) {
  const tip = node.tip
  return (
    <div
      className="fixed z-50 w-72 rounded-xl overflow-hidden shadow-2xl pointer-events-auto"
      style={{
        left: Math.min(pos.x + 12, window.innerWidth - 296),
        top:  Math.min(pos.y + 12, window.innerHeight - 260),
        background: 'rgba(10,11,15,0.97)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{
            background: node.kind === 'School' ? '#f59e0b'
              : node.kind === 'Category' ? (CATEGORY_COLOR[node.label] ?? '#14b8a6')
              : (URGENCY_COLOR[node.urgency ?? 'low'] ?? '#64748b')
          }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{node.kind}</span>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-sm">✕</button>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="text-sm font-semibold text-slate-200 leading-snug">{node.label}</div>
        {node.kind === 'School' && (
          <div className="text-xs text-slate-500">{node.count} tip{node.count !== 1 ? 's' : ''} from this school</div>
        )}
        {node.kind === 'Category' && (
          <div className="text-xs text-slate-500">{node.count} tip{node.count !== 1 ? 's' : ''} in this category</div>
        )}
        {tip && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                style={{ background: URGENCY_COLOR[tip.urgency] + '33', color: URGENCY_COLOR[tip.urgency], border: `1px solid ${URGENCY_COLOR[tip.urgency]}44` }}>
                {tip.urgency}
              </span>
              {tip.status && <span className="text-[9px] text-slate-600 uppercase">{tip.status}</span>}
            </div>
            {tip.caller_emotion && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600">Caller:</span>
                <span className="text-slate-300 capitalize">{tip.caller_emotion} · {tip.caller_tone}</span>
              </div>
            )}
            {tip.escalation_risk && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600">Escalation:</span>
                <span className={`capitalize font-semibold ${tip.escalation_risk === 'imminent' ? 'text-red-400' : tip.escalation_risk === 'escalating' ? 'text-orange-400' : 'text-green-400'}`}>
                  {tip.escalation_risk}
                </span>
              </div>
            )}
            {tip.school_name && (
              <div className="text-[10px] text-slate-600">📍 {tip.school_name}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { tips: Tip[] }

export default function ThreatGraph({ tips }: Props) {
  const graphRef    = useRef<any>(null)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })

  const graphData = useMemo(() => buildGraphData(tips), [tips])

  // Build Three.js node objects — runs client-side only (inside dynamic import)
  const nodeThreeObject = useMemo(() => {
    return (node: GraphNode) => {
      // THREE is always available here — we're inside a client-only dynamic import
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const THREE = require('three')

      const group = new THREE.Group()
      const isSchool   = node.kind === 'School'
      const isCategory = node.kind === 'Category'

      // Geometry
      let geo: any
      if (isSchool) {
        geo = new THREE.SphereGeometry(Math.max(12, (node.count ?? 1) * 5), 16, 16)
      } else if (isCategory) {
        geo = new THREE.OctahedronGeometry(10, 0)
      } else {
        // Tip — size by urgency
        const r = node.urgency === 'critical' ? 9 : node.urgency === 'high' ? 7 : node.urgency === 'medium' ? 5 : 4
        geo = new THREE.SphereGeometry(r, 12, 12)
      }

      // Material color
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

      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        shininess: 90,
        transparent: true,
        opacity: 0.9,
      })
      group.add(new THREE.Mesh(geo, mat))

      // Glow sprite for schools and critical tips
      if (isSchool || node.urgency === 'critical') {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 64
        const ctx = canvas.getContext('2d')!
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
        const glowColor = isSchool ? 'rgba(245,158,11,' : 'rgba(239,68,68,'
        grad.addColorStop(0, glowColor + '0.6)')
        grad.addColorStop(1, glowColor + '0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 64, 64)
        const tex = new THREE.CanvasTexture(canvas)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
        const scale = isSchool ? Math.max(50, (node.count ?? 1) * 18) : 40
        sprite.scale.setScalar(scale)
        group.add(sprite)
      }

      return group
    }
  }, [])

  // Add scene lighting after graph mounts
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

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center" style={{ background: '#06080d' }}>

      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-10">
          <div className="text-2xl opacity-20">🕸️</div>
          <div className="text-xs text-slate-600">No tips yet — graph builds as calls come in</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-3 rounded-xl"
        style={{ background: 'rgba(6,8,13,0.85)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-1">Graph Legend</div>
        {[
          { color: '#f59e0b', label: 'School',          shape: '●' },
          { color: '#14b8a6', label: 'Category',         shape: '◆' },
          { color: '#ef4444', label: 'Critical Tip',     shape: '●' },
          { color: '#f97316', label: 'High Tip',         shape: '●' },
          { color: '#eab308', label: 'Medium Tip',       shape: '●' },
          { color: '#f97316', label: 'Similar Threats',  shape: '—' },
          { color: '#14b8a6', label: 'Category Link',    shape: '—' },
        ].map(({ color, label, shape }) => (
          <div key={label} className="flex items-center gap-2">
            <span style={{ color, fontSize: shape === '—' ? 14 : 10 }}>{shape}</span>
            <span className="text-[9px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Stats bar */}
      <div className="absolute top-4 right-4 z-10 flex gap-4 p-3 rounded-xl"
        style={{ background: 'rgba(6,8,13,0.85)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
        <div className="text-center">
          <div className="text-lg font-black text-slate-200 tabular-nums">{tips.length}</div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wide">tips</div>
        </div>
        <div className="w-px bg-slate-800" />
        <div className="text-center">
          <div className="text-lg font-black text-red-400 tabular-nums">
            {tips.filter(t => t.urgency === 'critical').length}
          </div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wide">critical</div>
        </div>
        <div className="w-px bg-slate-800" />
        <div className="text-center">
          <div className="text-lg font-black text-amber-400 tabular-nums">
            {new Set(tips.map(t => t.school_name).filter(Boolean)).size}
          </div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wide">schools</div>
        </div>
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
