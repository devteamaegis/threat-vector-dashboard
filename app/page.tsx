'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase, type Tip } from '@/lib/supabase'
import type { OrbMode } from '@/components/ClaudiaOrb'

const ClaudiaOrb          = dynamic(() => import('@/components/ClaudiaOrb'),          { ssr: false })
const ThreatGraph         = dynamic(() => import('@/components/ThreatGraph'),         { ssr: false })
const ThemeToggle         = dynamic(() => import('@/components/ThemeToggle'),         { ssr: false })
const PipelineView        = dynamic(() => import('@/components/PipelineView'),        { ssr: false })
const ThreatBreakdownModal = dynamic(() => import('@/components/ThreatBreakdownModal'), { ssr: false })

import {
  IconWeapon, IconBullying, IconDrugs, IconThreat, IconSelfHarm,
  IconVandalism, IconHarassment, IconFile, IconGrid, IconEye, IconFlow,
  IconGlobe, IconSearch, IconBrain, IconSparkle, IconDatabase,
  IconCloud, IconDna, IconPhone, IconMail, IconCreditCard,
} from '@/components/Icons'

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_BG: Record<string, string> = {
  critical: 'bg-red-600/90 text-white',
  high:     'bg-orange-500/90 text-white',
  medium:   'bg-yellow-500/90 text-black',
  low:      'bg-slate-600/80 text-zinc-900',
}
function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  const cls = "shrink-0"
  switch (category) {
    case 'weapon':     return <IconWeapon     size={size} className={cls} />
    case 'bullying':   return <IconBullying   size={size} className={cls} />
    case 'drugs':      return <IconDrugs      size={size} className={cls} />
    case 'threat':     return <IconThreat     size={size} className={cls} />
    case 'self_harm':  return <IconSelfHarm   size={size} className={cls} />
    case 'vandalism':  return <IconVandalism  size={size} className={cls} />
    case 'harassment': return <IconHarassment size={size} className={cls} />
    default:           return <IconFile       size={size} className={cls} />
  }
}
const STATUS_STYLE: Record<string, string> = {
  new:       'text-red-400 border-red-800/60 bg-red-950/40',
  reviewing: 'text-yellow-400 border-yellow-800/60 bg-yellow-950/40',
  resolved:  'text-green-400 border-green-800/60 bg-green-950/40',
  dismissed: 'text-zinc-500 border-zinc-700/60 bg-[var(--surface-2)]/40',
}
const EMOTION_COLOR: Record<string, string> = {
  calm:       'text-green-400',
  anxious:    'text-yellow-400',
  panicked:   'text-orange-400',
  distressed: 'text-red-400',
  detached:   'text-zinc-600',
}
const ESCALATION_COLOR: Record<string, string> = {
  stable:     'text-green-400',
  escalating: 'text-orange-400',
  imminent:   'text-red-400',
}

const SPONSORS = [
  { name: 'Anthropic',       role: 'Claude AI',          color: '#f97316' },
  { name: 'Google DeepMind', role: 'Gemini Live',        color: '#4285f4' },
  { name: 'AgentPhone',      role: 'Voice Calls',        color: '#06b6d4' },
  { name: 'AgentMail',       role: 'Email Briefs',       color: '#8b5cf6' },
  { name: 'Supermemory',     role: 'Pattern Memory',     color: '#f59e0b' },
  { name: 'Moss',            role: 'Semantic Search',    color: '#6366f1' },
  { name: 'Stripe',          role: 'District Billing',   color: '#ec4899' },
  { name: 'Sponge',          role: 'Micropayments',      color: '#14b8a6' },
  { name: 'AWS',             role: 'Call Archive',       color: '#ff9900' },
  { name: 'Supabase',        role: 'Realtime DB',        color: '#10b981' },
]

const PIPELINE_STEPS: { id: string; label: string; icon: React.ReactNode; desc: string; ms: number }[] = [
  { id: 'gemini_live', label: 'Gemini Live', icon: <IconGlobe size={14} />,    desc: 'Multilingual detect', ms: 280  },
  { id: 'moss',        label: 'Moss',        icon: <IconSearch size={14} />,   desc: 'Semantic context',    ms: 620  },
  { id: 'claude',      label: 'Claude',      icon: <IconBrain size={14} />,    desc: 'Threat classify',     ms: 2400 },
  { id: 'gemini',      label: 'Gemini',      icon: <IconSparkle size={14} />,  desc: 'Consensus verify',    ms: 3100 },
  { id: 'supabase',    label: 'Supabase',    icon: <IconDatabase size={14} />, desc: 'Log to dashboard',    ms: 3400 },
  { id: 'aws',         label: 'AWS S3',      icon: <IconCloud size={14} />,    desc: 'Archive transcript',  ms: 3700 },
  { id: 'memory',      label: 'Memory',      icon: <IconDna size={14} />,      desc: 'Pattern storage',     ms: 4100 },
  { id: 'twilio',      label: 'Twilio',      icon: <IconPhone size={14} />,    desc: 'SMS to principal',    ms: 4600 },
  { id: 'agentmail',   label: 'AgentMail',   icon: <IconMail size={14} />,     desc: 'Email brief',         ms: 5200 },
  { id: 'stripe',      label: 'Stripe',      icon: <IconCreditCard size={14} />, desc: 'Bill district',     ms: 5800 },
]

// Demo: realistic anonymous call, no names/identifying info
const DEMO_WORDS = "Hi I need to report something anonymously . There is a student at Westbrook Academy who has been telling kids he is going to do something serious next week . He showed a photo of what looked like a weapon on his phone to someone in my class . Multiple people have seen it and we are all scared . This has been building for the past few weeks and the teachers don't know .".split(' ')

const DEMO_SMS = `[Kairos] ⚠️ CRITICAL
School: Westbrook Academy
Level: 5/5 — Immediate Response Required
Caller: distressed · urgent
Pattern: escalating over 2 weeks
Action: IMMEDIATE RESPONSE
— Kairos AI`

function buildDemoTip(): Tip {
  return {
    id: 'demo-' + Date.now(),
    description: "Anonymous caller reports a student at Westbrook Academy has been showing photos of a weapon and threatening peers. Escalating behavior over 2 weeks. Multiple student witnesses.",
    category: 'weapon',
    urgency: 'critical',
    severity: 'critical',
    status: 'new',
    is_anonymous: true,
    ai_summary: 'CRITICAL: Credible weapon threat at Westbrook Academy. Anonymous tip corroborated by multiple witnesses. Photo evidence circulating. 2-week escalation pattern. Immediate intervention required.',
    ai_triage_score: 9,
    ai_recommended_action: 'immediate_response',
    school_name: 'Westbrook Academy',
    caller_emotion: 'distressed',
    caller_tone: 'urgent',
    escalation_risk: 'imminent',
    credibility_signals: ['Multiple witnesses', 'Photo evidence described', 'Specific timeline given'],
    key_facts: ['Student showing weapon photos to peers', 'Threats made over 2 weeks', 'Multiple student witnesses', 'Pattern of escalation', 'Next week as stated timeline'],
    timeline: 'this_week',
    call_duration_seconds: 42,
    caller_language: 'English',
    multilingual_call: false,
    gemini_level: 5,
    gemini_reasoning: 'Weapon photo evidence and escalating pattern strongly indicate imminent threat',
    consensus: true,
    created_at: new Date().toISOString(),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

function patternBadge(tip: Tip, tips: Tip[]): string | null {
  if (!tip.school_name && !tip.category) return null
  const schoolTips = tips.filter(t => t.id !== tip.id && t.school_name === tip.school_name)
  if (schoolTips.length >= 2) return `${schoolTips.length + 1}× reports — ${tip.school_name?.split(' ').slice(0,2).join(' ')}`
  const catTips = tips.filter(t => t.id !== tip.id && t.category === tip.category && t.urgency === 'critical')
  if (catTips.length >= 1 && tip.urgency === 'critical') return `Pattern: ${catTips.length + 1} critical ${tip.category} threats`
  return null
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number | null | undefined }) {
  const val = score ?? 0
  const pct = Math.min(100, (val / 10) * 100)
  const col = pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-orange-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-slate-700'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-zinc-100 overflow-hidden">
        <div className={`h-full ${col} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-500 tabular-nums">{val}/10</span>
    </div>
  )
}

function Waveform({ active }: { active: boolean }) {
  const heights = [0.3, 0.7, 0.5, 1.0, 0.6, 0.9, 0.4, 0.8, 0.55, 0.75, 0.35, 0.9]
  return (
    <div className="flex items-center gap-[3px] h-6">
      {heights.map((h, i) => (
        <div key={i} className="w-[3px] rounded-full"
          style={{
            height: active ? `${h * 24}px` : '3px',
            background: active ? `rgba(6,182,212,${0.4 + h * 0.6})` : 'rgba(255,255,255,0.07)',
            animation: active ? `waveBar ${0.4 + (i % 4) * 0.15}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.05}s`,
            transition: 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

function PipelineVisualizer({ activeStep, stepTimes, demoStartMs }: {
  activeStep: number
  stepTimes: Record<number, number>
  demoStartMs: number
}) {
  const totalDone = activeStep >= PIPELINE_STEPS.length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-0 w-full overflow-x-auto">
        {PIPELINE_STEPS.map((step, i) => {
          const done   = i < activeStep
          const active = i === activeStep
          return (
            <div key={step.id} className="flex items-center min-w-0">
              <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all duration-400 ${
                active ? 'bg-cyan-950/70 border border-cyan-500/30' :
                done   ? 'bg-[var(--surface-2)]/60 border border-zinc-700/30' :
                         'border border-transparent opacity-40'
              }`}>
                <span className={`text-base transition-transform duration-300 ${active ? 'scale-110' : ''}`}>{step.icon}</span>
                <span className={`text-[9px] font-semibold uppercase tracking-wide ${
                  active ? 'text-cyan-400' : done ? 'text-zinc-600' : 'text-zinc-400'
                }`}>{step.label}</span>
                {done && stepTimes[i] !== undefined && (
                  <span className="text-[8px] font-mono text-green-500">{fmtMs(stepTimes[i])}</span>
                )}
                {active && (
                  <div className="flex gap-[3px]">
                    {[0,1,2].map(d => (
                      <div key={d} className="w-[3px] h-[3px] rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: `${d * 0.12}s` }} />
                    ))}
                  </div>
                )}
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={`w-2 h-px flex-shrink-0 transition-colors duration-400 ${done ? 'bg-slate-600' : 'bg-zinc-100'}`} />
              )}
            </div>
          )
        })}
      </div>
      {totalDone && demoStartMs > 0 && (
        <div className="text-center text-[11px] font-bold text-green-400 tracking-widest">
          ✓ COMPLETE IN {fmtMs(Date.now() - demoStartMs)} — PRINCIPAL NOTIFIED
        </div>
      )}
    </div>
  )
}

// iPhone notification
function IphoneNotif({ show, onDismiss }: { show: boolean; onDismiss: () => void }) {
  if (!show) return null
  return (
    <div className="fixed bottom-14 right-4 z-[200] w-76 rounded-2xl overflow-hidden shadow-2xl cursor-pointer select-none"
      onClick={onDismiss}
      style={{
        background: 'rgba(28,28,30,0.97)', backdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
        animation: 'slideUpNotif 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        width: 300,
      }}>
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-md">
          <span className="text-white text-xs font-black">TV</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white">Threat Vector</span>
            <span className="text-[9px] text-zinc-500">now</span>
          </div>
          <div className="text-[10px] text-zinc-600">Safety Alert — Westbrook Academy</div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <p className="text-[11px] text-zinc-800 leading-relaxed whitespace-pre-line">{DEMO_SMS}</p>
        <div className="mt-2 text-[9px] text-zinc-400">tap to dismiss</div>
      </div>
    </div>
  )
}

// Before/After card
function ImpactCard({ show, onDismiss }: { show: boolean; onDismiss: () => void }) {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center"
      style={{ animation: 'fadeInScale 0.45s cubic-bezier(0.34,1.2,0.64,1)' }}>
      <div className="rounded-2xl px-10 py-8 flex flex-col items-center gap-6 cursor-pointer"
        style={{
          background: 'rgba(6,8,13,0.98)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(239,68,68,0.2)',
          boxShadow: '0 0 100px rgba(239,68,68,0.12), 0 0 0 1px rgba(239,68,68,0.08)',
        }}
        onClick={onDismiss}>
        <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-400">Threat Triaged</div>
        <div className="flex items-center gap-10">
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-[9px] uppercase tracking-widest text-zinc-400">Traditional Process</div>
            <div className="text-5xl font-black text-zinc-400 tabular-nums leading-none">45m</div>
            <div className="text-[9px] text-zinc-400">avg response time</div>
            <div className="text-[9px] text-zinc-800">phone tag, email chains</div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-px h-8 bg-zinc-100" />
            <span className="text-zinc-400 text-sm font-light">→</span>
            <div className="w-px h-8 bg-zinc-100" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-[9px] uppercase tracking-widest text-cyan-600">Kairos</div>
            <div className="text-5xl font-black text-red-400 tabular-nums leading-none">8.2s</div>
            <div className="text-[9px] text-cyan-500">AI-triaged · principal notified</div>
            <div className="text-[9px] text-zinc-400">SMS + email + logged</div>
          </div>
        </div>
        <div className="text-[9px] text-zinc-400">tap to dismiss</div>
      </div>
    </div>
  )
}

function PricingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 rounded-2xl p-8 w-full max-w-sm"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}
        onClick={e => e.stopPropagation()}>
        <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-6">District Pricing</div>
        <div className="flex flex-col gap-3">
          {[
            { tier: 'Starter',  price: '$199/mo', schools: '1-5 schools',  tips: '500 tips/mo' },
            { tier: 'District', price: '$499/mo', schools: '6-20 schools', tips: 'Unlimited tips', highlight: true },
            { tier: 'State',    price: 'Custom',  schools: '20+ schools',  tips: 'White-label + API' },
          ].map(p => (
            <div key={p.tier} className={`rounded-lg p-4 ${p.highlight ? 'border border-cyan-500/30 bg-cyan-950/20' : 'border border-zinc-800'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${p.highlight ? 'text-cyan-400' : 'text-zinc-800'}`}>{p.tier}</span>
                <span className={`text-sm font-black tabular-nums ${p.highlight ? 'text-white' : 'text-zinc-600'}`}>{p.price}</span>
              </div>
              <div className="text-[10px] text-zinc-400">{p.schools} · {p.tips}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[9px] text-zinc-400 text-center">Powered by Stripe · Per-tip billing available</div>
        <button onClick={onClose} className="mt-4 w-full py-2 rounded-lg text-[11px] font-semibold text-zinc-600 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

function IntegrationStatus() {
  const [statuses, setStatuses] = useState<Record<string, boolean>>({})
  const integrations = [
    { name: 'Anthropic', key: 'anthropic' },
    { name: 'Gemini', key: 'gemini' },
    { name: 'AgentPhone', key: 'agentphone' },
    { name: 'AgentMail', key: 'agentmail' },
    { name: 'Supermemory', key: 'supermemory' },
    { name: 'Moss', key: 'moss' },
    { name: 'Stripe', key: 'stripe' },
    { name: 'Sponge', key: 'sponge' },
    { name: 'AWS S3', key: 'aws' },
    { name: 'Supabase', key: 'supabase' },
  ]

  useEffect(() => {
    let cancelled = false
    fetch('/api/integrations')
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setStatuses(data.integrations ?? {})
      })
      .catch(() => {
        if (!cancelled) setStatuses({})
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Integration Status</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {integrations.map(item => {
          const ready = Boolean(statuses[item.key])
          return (
            <div key={item.key} className="flex items-center gap-1.5 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ready ? 'bg-green-500' : 'bg-slate-700'}`} />
              <span className="text-[9px] text-zinc-500 truncate">{item.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CostTracker() {
  const costs = [
    { label: 'Gemini Live',  cost: 0.0008, color: 'text-blue-500' },
    { label: 'Claude',       cost: 0.0210, color: 'text-orange-500' },
    { label: 'Gemini Flash', cost: 0.0003, color: 'text-blue-400' },
    { label: 'AgentMail',    cost: 0.0010, color: 'text-purple-500' },
    { label: 'SMS (Twilio)', cost: 0.0075, color: 'text-red-500' },
    { label: 'AWS S3',       cost: 0.0001, color: 'text-yellow-600' },
  ]
  const total = costs.reduce((s, c) => s + c.cost, 0)
  return (
    <div className="rounded-lg p-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-400">Cost Per Tip</span>
        <span className="text-[10px] font-bold text-green-400 tabular-nums">${total.toFixed(4)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {costs.map(c => (
          <div key={c.label} className="flex items-center justify-between">
            <span className={`text-[8px] ${c.color}`}>{c.label}</span>
            <span className="text-[8px] font-mono text-zinc-400">${c.cost.toFixed(4)}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 pt-1.5 border-t text-[8px] text-zinc-400" style={{ borderColor: 'var(--border)' }}>
        District billed $0.15-0.35 per tip via Stripe · Sponge handles agent micropayments
      </div>
    </div>
  )
}

// Tip row in feed
function TipRow({ tip, onClick, fresh, onAnalyze }: { tip: Tip; allTips?: Tip[]; onClick: () => void; fresh?: boolean; onAnalyze?: (tip: Tip) => void }) {
  const urgency = tip.urgency?.toLowerCase() ?? 'low'
  return (
    <button onClick={onClick}
      className="group w-full text-left p-3 rounded-lg transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: fresh ? 'rgba(6,182,212,0.05)' : 'var(--surface)',
        border: `1px solid ${fresh ? 'rgba(6,182,212,0.35)' : urgency === 'critical' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
        boxShadow: urgency === 'critical' ? '0 2px 12px rgba(239,68,68,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[var(--muted)] flex items-center justify-center w-4 h-4">
            <CategoryIcon category={tip.category} size={13} />
          </span>
          <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${URGENCY_BG[urgency]}`}>{tip.urgency}</span>
          <span className="text-xs text-[var(--foreground)] font-medium truncate capitalize">{tip.category?.replace(/_/g,' ')}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[9px] font-medium uppercase px-1.5 py-0.5 rounded border ${STATUS_STYLE[tip.status?.toLowerCase() ?? 'new'] ?? STATUS_STYLE.new}`}>{tip.status}</span>
          <span className="text-[10px] text-[var(--muted-2)] tabular-nums">{timeAgo(tip.submitted_at ?? tip.created_at)}</span>
        </div>
      </div>
      <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">{tip.ai_summary ?? tip.description}</p>
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {tip.school_name && <span className="text-[10px] text-[var(--muted-2)]">📍 {tip.school_name}</span>}
        {tip.multilingual_call && tip.caller_language && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/30 text-indigo-400">
            🌐 {tip.caller_language}
          </span>
        )}
        {onAnalyze && (
          <span
            className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            onClick={e => { e.stopPropagation(); onAnalyze(tip) }}
          >
            Analyze
          </span>
        )}
      </div>
    </button>
  )
}

function DispatchBriefCard({ brief }: { brief: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(brief)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-500">911 Dispatch Brief</div>
        <button onClick={copy}
          className="text-[10px] font-semibold px-3 py-1 rounded transition-all"
          style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: copied ? '#4ade80' : '#f87171', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {copied ? '✓ Copied' : '📋 Copy for 911'}
        </button>
      </div>
      <p className="text-xs text-red-200 leading-relaxed font-mono whitespace-pre-wrap">{brief}</p>
    </div>
  )
}

function TipRowSkeleton() {
  return (
    <div className="w-full p-3 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[var(--surface-3)] animate-pulse" />
          <div className="w-12 h-4 rounded bg-[var(--surface-3)] animate-pulse" />
          <div className="w-16 h-3 rounded bg-[var(--surface-3)] animate-pulse" />
        </div>
        <div className="w-14 h-4 rounded bg-[var(--surface-3)] animate-pulse" />
      </div>
      <div className="w-full h-3 rounded bg-zinc-100 mb-1.5 animate-pulse" />
      <div className="w-2/3 h-3 rounded bg-zinc-100 mb-3 animate-pulse" />
      <div className="flex items-center gap-2">
        <div className="w-20 h-3 rounded bg-[var(--surface-3)] animate-pulse" />
        <div className="w-16 h-3 rounded bg-[var(--surface-3)] animate-pulse" />
        <div className="w-16 h-3 rounded bg-[var(--surface-3)] animate-pulse" />
      </div>
    </div>
  )
}

function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: 'D', desc: 'Trigger demo call' },
    { key: 'ESC', desc: 'Close tip drawer / modal' },
    { key: '↑/↓', desc: 'Navigate between tips' },
    { key: 'R', desc: 'Refresh tips list' },
  ]
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 rounded-xl p-6 w-full max-w-xs"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Keyboard Shortcuts</div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-800 transition-colors w-6 h-6 flex items-center justify-center rounded">✕</button>
        </div>
        <div className="flex flex-col gap-2.5">
          {shortcuts.map(s => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-xs text-zinc-600">{s.desc}</span>
              <span className="px-2 py-1 rounded bg-zinc-100 border border-zinc-200 text-[10px] font-bold text-zinc-700 min-w-[28px] text-center">{s.key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Submit Tip Modal ─────────────────────────────────────────────────────────

type TipSubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; callId: string }
  | { status: 'error'; message: string }

const RAILWAY_BASE = 'https://threat-vector-production.up.railway.app'

function SubmitTipModal({ onClose }: { onClose: () => void }) {
  const [school, setSchool]       = useState('')
  const [category, setCategory]   = useState('other')
  const [tipText, setTipText]     = useState('')
  const [state, setState]         = useState<TipSubmitState>({ status: 'idle' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState({ status: 'loading' })
    try {
      const res = await fetch(`${RAILWAY_BASE}/api/tip/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript:   tipText.trim(),
          school_name:  school.trim(),
          category,
          tip_source:   'web_form',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setState({ status: 'error', message: err.error ?? `HTTP ${res.status}` })
        return
      }
      const data = await res.json() as { call_id: string }
      setState({ status: 'success', callId: data.call_id })
    } catch (err) {
      setState({ status: 'error', message: String(err) })
    }
  }

  const inputCls = [
    'w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors',
    'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)]',
    'placeholder:text-[var(--muted-2)] focus:border-[var(--border-strong)]',
  ].join(' ')

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          animation: 'fadeInScale 0.18s ease-out both',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-[13px] font-black tracking-wide text-[var(--foreground)]">Submit a Tip</div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">Anonymous — processed by Kairos AI</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors text-lg leading-none">×</button>
        </div>

        {state.status === 'success' ? (
          <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
            <div className="text-3xl">✓</div>
            <div className="text-[13px] font-bold text-emerald-400">Tip received</div>
            <div className="text-[11px] text-[var(--muted)]">ID: <span className="font-mono text-[var(--foreground-2)]">{(state as { status: 'success'; callId: string }).callId}</span></div>
            <div className="text-[11px] text-[var(--muted)]">The Kairos AI pipeline is now analysing your submission.</div>
            <button onClick={onClose} className="mt-2 px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-emerald-400 border border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-950/40 transition-colors">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-5 flex flex-col gap-4">
            {/* School */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">School Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Westbrook Academy"
                value={school}
                onChange={e => setSchool(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputCls}
              >
                <option value="weapon">Weapon</option>
                <option value="bullying">Bullying</option>
                <option value="drugs">Drugs</option>
                <option value="threat">Threat</option>
                <option value="self_harm">Self Harm</option>
                <option value="vandalism">Vandalism</option>
                <option value="harassment">Harassment</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Tip Description</label>
              <textarea
                required
                rows={5}
                placeholder="Describe what you saw or heard. Do not include names."
                value={tipText}
                onChange={e => setTipText(e.target.value)}
                className={inputCls}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Error */}
            {state.status === 'error' && (
              <div className="rounded-lg px-3 py-2.5 text-[12px] text-red-400" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
                {(state as { status: 'error'; message: string }).message}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">Cancel</button>
              <button
                type="submit"
                disabled={state.status === 'loading'}
                className={`px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-all ${
                  state.status === 'loading'
                    ? 'border-[var(--border)] text-[var(--muted)] cursor-not-allowed'
                    : 'border-emerald-500/60 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 hover:border-emerald-500'
                }`}
              >
                {state.status === 'loading' ? 'Submitting…' : 'Submit Anonymously'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Threat keyword sets for word-level highlighting ──────────────────────────
const THREAT_WORDS = new Set([
  'gun','guns','weapon','weapons','knife','knives','bomb','bombs','shoot','shooting','shot',
  'kill','killing','killed','hurt','harm','harming','attack','attacking','attacked',
  'threat','threatening','threatened','violence','violent','die','dead','death',
  'fight','fighting','hurt','destroy','explode','explosion','blood',
])
const URGENT_WORDS = new Set([
  'tomorrow','today','tonight','now','soon','immediately','urgent','quickly','right now',
  'planning','plan','going to','will','about to','next week','morning','tonight',
])
const FEAR_WORDS = new Set([
  'scared','terrified','afraid','fear','worried','nervous','panic','please','help',
  'dangerous','serious','warning','everyone','kids','students','people',
])

function classifyWord(w: string): 'threat' | 'urgent' | 'fear' | 'neutral' {
  const lower = w.toLowerCase().replace(/[^a-z]/g, '')
  if (THREAT_WORDS.has(lower)) return 'threat'
  if (URGENT_WORDS.has(lower)) return 'urgent'
  if (FEAR_WORDS.has(lower)) return 'fear'
  return 'neutral'
}

function inferTone(transcript: string, features: string[]): { label: string; color: string; emoji: string } {
  const t = transcript.toLowerCase()
  const hasThreat = [...THREAT_WORDS].some(w => t.includes(w))
  const hasFear   = [...FEAR_WORDS].some(w => t.includes(w))
  const hasUrgent = [...URGENT_WORDS].some(w => t.includes(w))
  if (hasThreat && hasUrgent) return { label: 'Threatening · Urgent', color: '#ef4444', emoji: '🚨' }
  if (hasThreat)               return { label: 'Threatening',          color: '#ef4444', emoji: '⚠️' }
  if (hasFear && hasUrgent)    return { label: 'Distressed · Urgent',  color: '#f97316', emoji: '😨' }
  if (hasFear)                 return { label: 'Distressed',           color: '#f97316', emoji: '😟' }
  if (hasUrgent)               return { label: 'Urgent',               color: '#f59e0b', emoji: '⏱' }
  return                              { label: 'Calm · Reporting',     color: '#22c55e', emoji: '📞' }
}

function LiveCallOverlay({ call, onDismiss }: { call: { callId: string, transcript: string, probability: number, threatLevel: number, school: string, features: string[] }; onDismiss?: () => void }) {
  const pct = Math.min(call.probability, 100)
  const barColor = pct >= 70 ? '#ef4444' : pct >= 35 ? '#f97316' : pct >= 10 ? '#f59e0b' : '#22c55e'
  const tone = inferTone(call.transcript, call.features)
  const words = call.transcript.split(' ').filter(Boolean)

  // Count word types for the breakdown bar
  const counts = words.reduce((acc, w) => {
    acc[classifyWord(w)]++; return acc
  }, { threat: 0, urgent: 0, fear: 0, neutral: 0 } as Record<string, number>)

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
      {/* Dim backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      <div className="relative pointer-events-auto w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(6,8,13,0.97)',
          border: `1px solid ${barColor}40`,
          boxShadow: `0 0 80px ${barColor}25, 0 0 0 1px ${barColor}15`,
        }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: `1px solid ${barColor}20`, background: `${barColor}10` }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-[0.25em] text-red-400">Live Call Active</span>
          <span className="text-[10px] text-zinc-400 font-mono ml-4">{call.school}</span>
          <button onClick={onDismiss}
            className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/5 text-base shrink-0">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-0">

          {/* ── Left: transcript with highlighted words ──────────────── */}
          <div className="px-6 py-5" style={{ borderRight: `1px solid rgba(255,255,255,0.06)` }}>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">Transcript</div>
            <div className="text-[12px] leading-7 font-medium flex flex-wrap gap-x-1.5 gap-y-0.5">
              {words.map((word, i) => {
                const type = classifyWord(word)
                const style =
                  type === 'threat'  ? { color: '#ef4444', background: 'rgba(239,68,68,0.15)',  borderRadius: 4, padding: '1px 4px', fontWeight: 700 } :
                  type === 'urgent'  ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)', borderRadius: 4, padding: '1px 4px', fontWeight: 600 } :
                  type === 'fear'    ? { color: '#f97316', background: 'rgba(249,115,22,0.10)', borderRadius: 4, padding: '1px 4px' } :
                  { color: '#a1a1aa' }
                return <span key={i} style={style}>{word}</span>
              })}
              <span className="inline-block w-0.5 h-4 bg-cyan-400 animate-pulse align-middle ml-0.5" />
            </div>

            {/* Word type legend */}
            <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: 'Threat', color: '#ef4444' },
                { label: 'Urgent', color: '#f59e0b' },
                { label: 'Fear',   color: '#f97316' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1 text-[9px]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: l.color, opacity: 0.7 }} />
                  <span style={{ color: l.color }}>{l.label}</span>
                </span>
              ))}
            </div>
          </div>

          {/* ── Right: analysis panel ────────────────────────────────── */}
          <div className="px-6 py-5 flex flex-col gap-4">

            {/* Threat probability */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Threat Probability</span>
                <span className="text-xl font-black tabular-nums" style={{ color: barColor }}>{pct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, #22c55e, ${barColor})` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-zinc-500">Level {call.threatLevel}/5</span>
                <span className="text-[9px] text-zinc-500">Bayesian Monte Carlo</span>
              </div>
            </div>

            {/* Tone reading */}
            <div className="rounded-xl px-4 py-3" style={{ background: `${tone.color}12`, border: `1px solid ${tone.color}25` }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">Caller Tone</div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{tone.emoji}</span>
                <span className="text-sm font-bold" style={{ color: tone.color }}>{tone.label}</span>
              </div>
            </div>

            {/* Word signal breakdown */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Signal Breakdown</div>
              <div className="space-y-1.5">
                {[
                  { key: 'threat', label: 'Threat words',  color: '#ef4444' },
                  { key: 'urgent', label: 'Urgency words', color: '#f59e0b' },
                  { key: 'fear',   label: 'Fear markers',  color: '#f97316' },
                ].map(({ key, label, color }) => {
                  const n = counts[key] || 0
                  const total = words.length || 1
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[9px] w-24 shrink-0" style={{ color }}>{label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, (n / total) * 100 * 6)}%`, background: color }} />
                      </div>
                      <span className="text-[9px] text-zinc-500 tabular-nums w-4 text-right">{n}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Trigger keywords */}
            {call.features.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Key Triggers</div>
                <div className="flex flex-wrap gap-1.5">
                  {call.features.map((f, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-6 py-3 flex items-center gap-2"
          style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[9px] text-zinc-600 font-mono">ID: {call.callId.slice(0,16)}</span>
          <span className="ml-auto text-[9px] text-zinc-600 uppercase tracking-wider">Processing pipeline…</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// Demo call pipeline overlay — top-right, pipeline steps only (transcript shown in center)
function DemoCallOverlay({ pipelineStep }: {
  transcript: string
  transcriptFull: boolean
  waveActive: boolean
  pipelineStep: number
}) {
  if (pipelineStep < 0) return null
  const stepsDone = Math.min(pipelineStep, PIPELINE_STEPS.length)
  return (
    <div className="fixed top-16 right-4 z-[110] w-72 pointer-events-none">
      {/* Pipeline status card */}
      <div className="rounded-xl overflow-hidden shadow-xl"
        style={{
          background: 'rgba(6,8,13,0.94)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.07)',
          animation: 'slideDownOverlay 0.3s cubic-bezier(0.34,1.4,0.64,1)',
        }}>
        <div className="px-4 py-2.5">
          <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2">AI Pipeline</div>
          <div className="flex items-center gap-1 flex-wrap">
            {PIPELINE_STEPS.map((step, i) => {
              const done   = i < pipelineStep
              const active = i === pipelineStep
              return (
                <div key={step.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all duration-300 ${
                  active ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/40' :
                  done   ? 'text-zinc-500' : 'text-zinc-700'
                }`}>
                  <span>{step.icon}</span>
                  {active && <span className="font-bold">{step.label}</span>}
                  {done && <span className="text-green-500 text-[8px]">✓</span>}
                </div>
              )
            })}
          </div>
          {stepsDone === PIPELINE_STEPS.length && (
            <div className="mt-2 text-[10px] font-bold text-green-400 tracking-wide">✓ PRINCIPAL NOTIFIED</div>
          )}
        </div>
      </div>
    </div>
  )
}

// Tip drawer (detail panel)
function TipDrawer({ tip, onClose, onStatusChange, onAnalyze }: { tip: Tip; onClose: () => void; onStatusChange?: (id: string, status: string) => void; onAnalyze?: (tip: Tip) => void }) {
  const urgency = tip.urgency?.toLowerCase() ?? 'low'
  const score   = tip.ai_triage_score ?? tip.ai_score
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-sm" style={{background: 'rgba(9,9,11,0.35)'}} />
      <div className="relative z-10 ml-auto h-full w-full max-w-md flex flex-col overflow-y-auto"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[var(--muted)] flex items-center justify-center w-4 h-4">
              <CategoryIcon category={tip.category} size={14} />
            </span>
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${URGENCY_BG[urgency]}`}>{tip.urgency}</span>
            <span className="text-sm font-semibold text-[var(--foreground)] capitalize">{tip.category?.replace(/_/g,' ')}</span>
          </div>
          {onAnalyze && (
            <button
              onClick={() => { onAnalyze(tip); onClose() }}
              className="text-[10px] font-bold px-3 py-1 rounded-lg transition-all hover:opacity-90 flex items-center gap-1.5"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              Analyze
            </button>
          )}
          <a
            href={`/api/report/${tip.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold px-3 py-1 rounded transition-all hover:opacity-80"
            style={{ background: '#f0f0f0', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Report
          </a>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-800 transition-colors w-6 h-6 flex items-center justify-center rounded">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Meta row */}
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-semibold uppercase px-2 py-1 rounded border tracking-widest ${STATUS_STYLE[tip.status?.toLowerCase() ?? 'new'] ?? STATUS_STYLE.new}`}>
              {tip.status}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">{new Date(tip.submitted_at ?? tip.created_at).toLocaleString()}</span>
          </div>

          {/* School */}
          {tip.school_name && (
            <div className="flex items-center gap-2 text-sm text-[var(--foreground-2)]">
              <span className="text-zinc-400">📍</span><span className="font-medium">{tip.school_name}</span>
            </div>
          )}

          {/* AI Assessment */}
          {tip.ai_summary && (
            <div className="rounded-lg p-4" style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)' }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-700 mb-2">AI Assessment</div>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">{tip.ai_summary}</p>
            </div>
          )}

          {(tip.gemini_level != null || tip.consensus != null) && (
            <div className="rounded-lg p-4" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-3">Multi-Model Consensus</div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-zinc-400 mb-0.5 text-[9px]">Claude</div>
                  <div className="text-orange-400 font-bold">{tip.ai_triage_score ?? '–'}/10</div>
                </div>
                <div>
                  <div className="text-zinc-400 mb-0.5 text-[9px]">Gemini</div>
                  <div className="text-blue-400 font-bold">{tip.gemini_level != null ? `${tip.gemini_level}/5` : '–'}</div>
                </div>
                <div>
                  <div className="text-zinc-400 mb-0.5 text-[9px]">Consensus</div>
                  <div className={`font-bold ${tip.consensus ? 'text-green-400' : 'text-yellow-500'}`}>
                    {tip.consensus ? 'CONFIRMED' : 'DIVERGENT'}
                  </div>
                </div>
              </div>
              {tip.gemini_reasoning && (
                <p className="text-[10px] text-zinc-400 mt-2 italic">{tip.gemini_reasoning}</p>
              )}
              {tip.multilingual_call && tip.caller_language && (
                <div className="mt-2 pt-2 border-t text-[10px] text-indigo-500" style={{ borderColor: 'var(--border)' }}>
                  🌐 Originally in {tip.caller_language} - auto-translated by Gemini Live
                </div>
              )}
            </div>
          )}

          {/* Caller analysis */}
          {(tip.caller_emotion || tip.caller_tone || tip.escalation_risk) && (
            <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-3">Caller Analysis</div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                {tip.caller_emotion && (
                  <div>
                    <div className="text-zinc-400 mb-0.5 text-[9px]">Emotion</div>
                    <div className={`font-semibold capitalize ${EMOTION_COLOR[tip.caller_emotion] ?? 'text-zinc-600'}`}>{tip.caller_emotion}</div>
                  </div>
                )}
                {tip.caller_tone && (
                  <div>
                    <div className="text-zinc-400 mb-0.5 text-[9px]">Tone</div>
                    <div className="text-[var(--foreground-2)] capitalize">{tip.caller_tone}</div>
                  </div>
                )}
                {tip.escalation_risk && (
                  <div>
                    <div className="text-zinc-400 mb-0.5 text-[9px]">Escalation</div>
                    <div className={`font-bold capitalize ${ESCALATION_COLOR[tip.escalation_risk] ?? 'text-zinc-600'}`}>{tip.escalation_risk}</div>
                  </div>
                )}
              </div>
              {tip.call_duration_seconds && (
                <div className="mt-3 pt-3 border-t text-xs text-zinc-400" style={{ borderColor: 'var(--border)' }}>
                  Call duration: <span className="text-zinc-600">{tip.call_duration_seconds}s</span>
                </div>
              )}
            </div>
          )}

          {/* Credibility signals */}
          {tip.credibility_signals && tip.credibility_signals.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Credibility Signals</div>
              <div className="flex flex-col gap-1">
                {tip.credibility_signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                    <span className="text-green-600 mt-0.5 shrink-0">+</span>{s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key facts */}
          {tip.key_facts && tip.key_facts.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Key Facts</div>
              <div className="flex flex-col gap-1">
                {tip.key_facts.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                    <span className="text-zinc-400 mt-0.5 shrink-0">·</span>{f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 911 Dispatch Brief — level 4-5 only */}
          {tip.dispatch_brief && (
            <DispatchBriefCard brief={tip.dispatch_brief} />
          )}

          {/* Threat window */}
          {tip.threat_window && (
            <div className="rounded-lg p-3" style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-yellow-700 mb-1">Predicted Threat Window</div>
              <p className="text-sm text-yellow-300 font-semibold">{tip.threat_window}</p>
            </div>
          )}

          {/* Cross-school alert */}
          {tip.cross_school_alert && (
            <div className="rounded-lg p-3" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-500 mb-1">Cross-School Pattern</div>
              <p className="text-xs text-purple-300">{tip.cross_school_alert}</p>
            </div>
          )}

          {/* Bayesian score — click to open full simulation animation */}
          {tip.bayes_probability_pct != null ? (
            <button
              onClick={() => onAnalyze?.(tip)}
              className="w-full text-left rounded-lg p-4 transition-all hover:scale-[1.01] group"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">Bayesian Threat Probability</div>
                <span className="text-[9px] font-bold text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">View Simulation →</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl font-black tabular-nums" style={{ color: tip.bayes_probability_pct > 50 ? '#ef4444' : tip.bayes_probability_pct > 15 ? '#f97316' : '#22c55e' }}>
                  {tip.bayes_probability_pct}%
                </div>
                {tip.three_model_consensus && (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-green-950/50 border border-green-800/30 text-green-400">3-model consensus</span>
                )}
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(tip.bayes_probability_pct, 100)}%`, background: tip.bayes_probability_pct > 50 ? '#ef4444' : tip.bayes_probability_pct > 15 ? '#f97316' : '#22c55e' }} />
              </div>
              {tip.bayes_ci_low_pct != null && (
                <div className="mt-2 text-[9px] text-zinc-600 font-mono">
                  95% CI: {tip.bayes_ci_low_pct}–{tip.bayes_ci_high_pct}%
                </div>
              )}
            </button>
          ) : onAnalyze && (
            <button
              onClick={() => onAnalyze(tip)}
              className="w-full py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              Run Threat Analysis
            </button>
          )}

          {/* Recommended action */}
          {tip.ai_recommended_action && (
            <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-700 mb-1">Recommended Action</div>
              <p className="text-sm text-red-300 font-semibold capitalize">{tip.ai_recommended_action.replace(/_/g,' ')}</p>
            </div>
          )}

          {/* Transcript */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Caller Transcript</div>
            <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">{tip.description}</p>
          </div>

          {/* Data grid */}
          <div className="rounded-lg p-4 grid grid-cols-2 gap-4 text-xs"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {[
              ['Severity',  tip.severity ?? tip.urgency],
              ['Anonymous', tip.is_anonymous ? 'Yes' : 'No'],
              ['Timeline',  tip.timeline ?? '–'],
              ['AI Score',  `${score ?? '–'} / 10`],
            ].map(([k, v]) => (
              <div key={k}><div className="text-zinc-400 mb-0.5 text-[9px]">{k}</div><div className="text-[var(--foreground-2)] font-mono capitalize">{v}</div></div>
            ))}
          </div>

          <ScoreBar score={score} />
          {onStatusChange && (tip.status === 'new' || tip.status === 'reviewing') && (
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => onStatusChange(tip.id, tip.status === 'new' ? 'reviewing' : 'dismissed')}
                className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  tip.status === 'new'
                    ? 'bg-yellow-50 text-yellow-600 border border-yellow-200 hover:bg-yellow-100'
                    : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {tip.status === 'new' ? '✓ Mark Reviewing' : '✓ Mark Dismissed'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Stat block
function Stat({ label, value, red, sub }: { label: string; value: number; red?: boolean; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{label}</div>
      <div className={`text-3xl font-black tabular-nums leading-none ${red && value > 0 ? 'text-red-500' : 'text-[var(--foreground)]'}`}>{value}</div>
      {sub && <div className="text-[9px] text-zinc-400">{sub}</div>}
    </div>
  )
}

// Live call counter
function LiveCounter() {
  const [n, setN] = useState(1247)
  useEffect(() => {
    const id = setInterval(() => setN(c => c + Math.floor(Math.random() * 3)), 9000 + Math.random() * 3000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
      style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      <span className="text-[10px] font-mono text-zinc-500 tabular-nums">{n.toLocaleString()}</span>
      <span className="text-[9px] text-zinc-400">calls</span>
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

type TabId = 'command' | 'intelligence' | 'pipeline'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('command')
  const [tips, setTips]           = useState<Tip[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Tip | null>(null)
  const [filter, setFilter]       = useState('all')
  const [freshIds, setFreshIds]   = useState<Set<string>>(new Set())
  const [dateStr, setDateStr]     = useState('')
  const [orbMode, setOrbMode]     = useState<OrbMode>('thinking')
  const [showPricing, setShowPricing] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [dismissedAlert, setDismissedAlert] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  const [analysisTip, setAnalysisTip] = useState<Tip | null>(null)

  const [liveCall, setLiveCall] = useState<{callId: string, transcript: string, probability: number, threatLevel: number, school: string, features: string[]} | null>(null)

  // Demo
  const [demoRunning, setDemoRunning]       = useState(false)
  const [transcript, setTranscript]         = useState('')
  const [transcriptFull, setTranscriptFull] = useState(false)
  const [pipelineStep, setPipelineStep]     = useState(-1)
  const [stepTimes, setStepTimes]           = useState<Record<number,number>>({})
  const [waveActive, setWaveActive]         = useState(false)
  const [criticalFlash, setCriticalFlash]   = useState(false)
  const [showNotif, setShowNotif]           = useState(false)
  const [showImpact, setShowImpact]         = useState(false)
  const demoRef   = useRef<ReturnType<typeof setTimeout>[]>([])
  const demoStart = useRef(0)

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }))
  }, [])

  useEffect(() => {
    fetch('/api/tips')
      .then(r => r.json())
      .then(data => { setTips(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))

    const ch = supabase.channel('tips-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tips' }, payload => {
        const t = payload.new as Tip
        setTips(prev => [t, ...prev])
        setFreshIds(prev => new Set([...prev, t.id]))
        if (!demoRunning) { setOrbMode('speaking'); setTimeout(() => setOrbMode('idle'), 6000) }
        setTimeout(() => setFreshIds(f => { const n = new Set(f); n.delete(t.id); return n }), 8000)
      })
      .subscribe()

    // Subscribe to live call updates
    const liveCh = supabase.channel('live-calls-ui')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_calls' }, payload => {
        const d = payload.new as any
        if (d.status === 'active') {
          setLiveCall({ callId: d.call_id, transcript: d.words_so_far, probability: d.probability_pct, threatLevel: d.threat_level, school: d.school_name || 'Unknown School', features: d.top_features || [] })
          setOrbMode(d.threat_level >= 4 ? 'critical' : 'speaking')
        } else if (d.status === 'complete') {
          // Keep overlay visible for 20s on high/critical, 8s on lower threats
          const dismissDelay = (d.threat_level ?? 1) >= 4 ? 20000 : 8000
          setTimeout(() => { setLiveCall(null); setOrbMode('idle') }, dismissDelay)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch); supabase.removeChannel(liveCh) }
  }, [demoRunning])

  useEffect(() => {
    if (loading) { setOrbMode('thinking'); return }
    if (demoRunning) return
    // Orb only goes red during an active incoming call — not from existing tips in DB
    setOrbMode('idle')
  }, [loading, demoRunning, tips])

  const clearTimers = () => { demoRef.current.forEach(clearTimeout); demoRef.current = [] }

  const updateTipStatus = useCallback(async (id: string, status: string) => {
    try {
      await fetch(`/api/tips/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      setTips(prev => prev.map(t => t.id === id ? { ...t, status } : t))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
    } catch (err) {
      console.error('Failed to update tip status', err)
    }
  }, [selected])

  const runDemo = useCallback(() => {
    if (demoRunning) return
    clearTimers()
    setDemoRunning(true); setTranscript(''); setTranscriptFull(false)
    setPipelineStep(-1); setStepTimes({}); setWaveActive(true)
    setOrbMode('listening'); setCriticalFlash(false)
    fetch('/api/demo-live-call', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ school: 'Westbrook Academy', delay_ms: 180 })
    }).catch(console.error)
    setShowNotif(false); setShowImpact(false)
    demoStart.current = Date.now()

    // Pre-warm speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const w = new SpeechSynthesisUtterance(''); w.volume = 0
      window.speechSynthesis.speak(w)
    }

    let idx = 0
    const type = () => {
      if (idx >= DEMO_WORDS.length) {
        setTranscriptFull(true); setWaveActive(false); setOrbMode('thinking')
        PIPELINE_STEPS.forEach((_, i) => {
          const t = setTimeout(() => {
            setPipelineStep(i)
            setStepTimes(prev => ({ ...prev, [i]: Date.now() - demoStart.current }))
            if (i === PIPELINE_STEPS.length - 1) {
              const t2 = setTimeout(() => {
                setPipelineStep(PIPELINE_STEPS.length)
                setOrbMode('critical'); setCriticalFlash(true)
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance(
                    'Critical threat detected at Westbrook Academy. A student has been showing a weapon to peers. Escalating pattern over two weeks. Alerting school administrators now. Response required immediately.'
                  )
                  u.rate = 0.85; u.pitch = 0.95; u.volume = 1
                  const voices = window.speechSynthesis.getVoices()
                  const femaleVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Moira') || v.name.includes('Victoria') || (v.lang === 'en-US' && v.name.toLowerCase().includes('female')))
                  if (femaleVoice) u.voice = femaleVoice
                  window.speechSynthesis.speak(u)
                }
                const t3 = setTimeout(() => setCriticalFlash(false), 2500)
                const t4 = setTimeout(() => setShowNotif(true), 1000)
                const t5 = setTimeout(() => {
                  setTips(prev => {
                    const d = buildDemoTip()
                    setFreshIds(f => new Set([...f, d.id]))
                    setTimeout(() => setFreshIds(f => { const n = new Set(f); n.delete(d.id); return n }), 8000)
                    return [d, ...prev]
                  })
                }, 700)
                const t6 = setTimeout(() => setShowImpact(true), 2200)
                const t7 = setTimeout(() => {
                  setDemoRunning(false); setTranscript('')
                  setTranscriptFull(false); setPipelineStep(-1)
                }, 6500)
                demoRef.current.push(t3, t4, t5, t6, t7)
              }, 800)
              demoRef.current.push(t2)
            }
          }, i * 900)
          demoRef.current.push(t)
        })
        return
      }
      setTranscript(p => p + (idx > 0 ? ' ' : '') + DEMO_WORDS[idx])
      idx++
      const t = setTimeout(type, 55 + Math.random() * 55)
      demoRef.current.push(t)
    }
    type()
  }, [demoRunning])

  // Only show tips that came through the real AI pipeline:
  // call_duration_seconds is only set by AgentPhone on live calls — seed data never has it.
  const realTips = tips.filter(t =>
    t.call_duration_seconds != null && t.call_duration_seconds > 0
  )
  const filtered = filter === 'all'
    ? realTips
    : realTips.filter(t => t.urgency === filter || t.status === filter || t.category === filter)

  const critical  = realTips.filter(t => t.urgency === 'critical').length
  const newCount  = realTips.filter(t => t.status === 'new').length
  const resolved  = realTips.filter(t => t.status === 'resolved').length

  // SRO / principal stats — based on real pipeline tips only
  const actionNeeded      = realTips.filter(t => (t.status === 'new' || t.status === 'reviewing') && (t.urgency === 'critical' || t.urgency === 'high')).length
  const escalating        = realTips.filter(t => t.escalation_risk === 'imminent' || t.escalation_risk === 'escalating').length
  const weaponCount       = realTips.filter(t => t.category === 'weapon').length
  const multilingualCount = realTips.filter(t => t.multilingual_call).length
  const schoolsAffected   = new Set(realTips.map(t => t.school_name).filter(Boolean)).size
  const thisWeek          = realTips.filter(t => new Date(t.submitted_at ?? t.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length

  const crossSchoolAlert = tips.find(t => t.cross_school_alert && new Date(t.submitted_at ?? t.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)?.cross_school_alert

  // Keyboard shortcuts — placed after filtered/runDemo declarations to avoid hoisting issues
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case 'd': case 'D':
          if (!demoRunning) runDemo()
          break
        case 'Escape':
          setSelected(null); setShowShortcuts(false); setShowPricing(false)
          break
        case 'ArrowUp': case 'ArrowDown':
          if (filtered.length > 0) {
            e.preventDefault()
            const idx = selected ? filtered.findIndex(t => t.id === selected.id) : -1
            if (e.key === 'ArrowUp') setSelected(filtered[idx > 0 ? idx - 1 : filtered.length - 1])
            else setSelected(filtered[idx >= 0 && idx < filtered.length - 1 ? idx + 1 : 0])
          }
          break
        case 'r': case 'R':
          setLoading(true)
          fetch('/api/tips').then(r => r.json()).then(data => { setTips(Array.isArray(data) ? data : []); setLoading(false) }).catch(() => setLoading(false))
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [demoRunning, selected, filtered, runDemo])

  const ORB_LABEL: Record<OrbMode, string> = {
    idle: 'STANDBY', listening: 'CALL ACTIVE', thinking: 'ANALYZING', speaking: 'INCOMING', critical: 'CRITICAL ALERT', attendance: 'ATTENDANCE',
  }
  const ORB_COLOR: Record<OrbMode, string> = {
    idle: 'text-zinc-400', listening: 'text-orange-400', thinking: 'text-blue-400', speaking: 'text-cyan-400', critical: 'text-red-400', attendance: 'text-emerald-500',
  }

  return (
    <>
      <style>{`
        @keyframes waveBar { from{transform:scaleY(0.4)} to{transform:scaleY(1)} }
        @keyframes critFlash { 0%{opacity:0} 20%{opacity:1} 80%{opacity:0.7} 100%{opacity:0} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes slideUpNotif { from{transform:translateY(80px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeInScale { from{transform:scale(0.92);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes scanLine { 0%{transform:translateY(0)} 100%{transform:translateY(100%)} }
        @keyframes slideDownOverlay { from{transform:translateY(-12px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--background)', fontFamily: 'var(--font-roboto-slab), "Roboto Slab", Georgia, serif' }}>

        {liveCall && <LiveCallOverlay call={liveCall} onDismiss={() => { setLiveCall(null); setOrbMode('idle') }} />}
        {analysisTip && (
          <ThreatBreakdownModal
            transcript={analysisTip.description ?? ''}
            bayesProbPct={analysisTip.bayes_probability_pct}
            bayesCiLow={analysisTip.bayes_ci_low_pct}
            bayesCiHigh={analysisTip.bayes_ci_high_pct}
            bayesDrivers={analysisTip.bayes_top_drivers}
            threatLevel={analysisTip.ai_triage_score != null ? Math.round(analysisTip.ai_triage_score / 2) : null}
            callerEmotion={analysisTip.caller_emotion}
            callerTone={analysisTip.caller_tone}
            threeModelConsensus={analysisTip.three_model_consensus}
            schoolName={analysisTip.school_name}
            onClose={() => setAnalysisTip(null)}
          />
        )}
        {demoRunning && (
          <DemoCallOverlay
            transcript={transcript}
            transcriptFull={transcriptFull}
            waveActive={waveActive}
            pipelineStep={pipelineStep}
          />
        )}

        {/* Critical flash */}
        {criticalFlash && (
          <div className="fixed inset-0 z-[100] pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.3) 0%, transparent 65%)',
            animation: 'critFlash 2.5s ease-out forwards',
          }} />
        )}

        {/* Overlays */}
        <IphoneNotif show={showNotif} onDismiss={() => setShowNotif(false)} />
        <ImpactCard show={showImpact} onDismiss={() => setShowImpact(false)} />
        {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
        {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
        {showTipModal && <SubmitTipModal onClose={() => setShowTipModal(false)} />}

        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 z-0" style={{
          background: orbMode === 'critical'
            ? 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(239,68,68,0.06) 0%, transparent 70%)'
            : 'none',
          transition: 'background 1.8s ease',
        }} />

        {/* ── Header ── */}
        <header className="relative z-10 flex items-center justify-between px-5 h-12 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)', backdropFilter: 'blur(16px)', opacity: 0.97 }}>

          {/* Left: brand + tabs */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              {/* Logo */}
              <img src="/kairos-logo.svg" alt="Kairos" className="w-8 h-8 shrink-0" style={{ filter: 'brightness(1)' }} />
              <div>
                <div className="text-[13px] font-black text-[var(--foreground)] tracking-[0.06em] leading-none">Kairos</div>
                <div className="text-[8px] text-[var(--muted)] leading-none mt-0.5 tracking-widest">AI COMMAND CENTER</div>
              </div>
            </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {([
              { id: 'command',      label: 'Command Center',      icon: <IconGrid size={12} /> },
              { id: 'intelligence', label: 'Threat Intelligence', icon: <IconEye  size={12} /> },
              { id: 'pipeline',     label: 'Data Pipeline',       icon: <IconFlow size={12} /> },
            ] as { id: TabId; label: string; icon: React.ReactNode }[]).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-semibold tracking-wide transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm border border-[var(--border)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}>
                <span className="flex items-center">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <button onClick={() => setShowShortcuts(true)} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-[var(--muted)] border border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors">?</button>
          <LiveCounter />
            <button onClick={() => setShowTipModal(true)}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase px-3 py-1.5 rounded-md border transition-all tracking-widest border-emerald-500/60 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 hover:border-emerald-500">
              <span>+</span>Submit Tip
            </button>
            <button onClick={runDemo} disabled={demoRunning}
              className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase px-3 py-1.5 rounded-md border transition-all tracking-widest ${
                demoRunning
                  ? 'border-[var(--border)] text-[var(--muted)] cursor-not-allowed'
                  : 'border-cyan-500/60 text-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 hover:border-cyan-500'
              }`}>
              {demoRunning ? <><span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse" />Processing…</> : <><span>📞</span>Demo Call</>}
            </button>
            {criticalFlash && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-900/40 px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">
                ● CRITICAL
              </span>
            )}
            {!criticalFlash && newCount > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-900/40 px-2.5 py-1 rounded-full uppercase tracking-widest">
                <span className="relative"><span className="absolute w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" /><span className="w-1.5 h-1.5 rounded-full bg-red-400 block" /></span>
                {newCount} NEW
              </span>
            )}
              <span className="text-[10px] text-[var(--muted)] font-mono hidden xl:block">{dateStr}</span>
            </div>
          </header>

          {/* Cross-school alert banner */}
          {!dismissedAlert && crossSchoolAlert && activeTab === 'command' && (
            <div className="relative z-10 shrink-0 px-5 py-2.5 flex items-center justify-between" style={{ background: 'rgba(168,85,247,0.08)', borderBottom: '1px solid rgba(168,85,247,0.3)' }}>
              <div className="flex items-center gap-2">
                <span className="text-purple-600 animate-pulse">⚡</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-purple-700">Cross-school pattern detected:</span>
                <span className="text-[11px] text-purple-800 font-medium">{crossSchoolAlert}</span>
              </div>
              <button onClick={() => setDismissedAlert(true)} className="text-purple-500 hover:text-purple-800 text-lg leading-none">×</button>
            </div>
          )}

          {/* ── Tab: Command Center ── */}
          {activeTab === 'command' && (
          <div className="relative z-10 flex flex-1 min-h-0">

            {/* Left panel */}
            <div className="hidden lg:flex flex-col justify-between py-6 px-5 w-48 shrink-0"
              style={{ borderRight: '1px solid var(--border)' }}>
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Overview</div>
                  <button onClick={() => setShowPricing(true)}
                    className="px-2 py-1 rounded-md text-[9px] font-semibold uppercase tracking-wide text-cyan-400 border border-cyan-900/60 hover:border-cyan-700/70 hover:bg-cyan-950/20 transition-colors">
                    Pricing
                  </button>
                </div>
                <div className="flex flex-col gap-3" style={{ paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                  {/* Top urgency row */}
                  <div className="flex gap-4">
                    <Stat label="Action Needed" value={actionNeeded} red sub="high+ unresolved" />
                    <Stat label="Escalating"    value={escalating}   red={escalating > 0} sub="imminent risk" />
                  </div>
                  {/* Second row */}
                  <div className="flex gap-4">
                    <Stat label="This Week" value={thisWeek}   sub="reports filed" />
                    <Stat label="Weapons"   value={weaponCount} red={weaponCount > 0} sub="threat type" />
                  </div>
                  {/* Third row */}
                  <div className="flex gap-4">
                    <Stat label="Schools"   value={schoolsAffected} sub="monitored" />
                    <Stat label="Multilingual" value={multilingualCount} sub="non-English calls" />
                  </div>
                  {/* Response time highlight */}
                  <div className="rounded-lg px-3 py-2 flex items-center justify-between"
                    style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <span className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Avg Triage</span>
                    <span className="text-lg font-black text-cyan-400 tabular-nums">8.2s</span>
                  </div>
                </div>

              </div>

              <div className="flex flex-col gap-3">
                <IntegrationStatus />
                <CostTracker />
              </div>
            </div>

            {/* Center: orb + overlay */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 min-w-0 px-4 py-4 overflow-hidden">
              {/* Orb */}
              <div className="relative flex items-center justify-center w-full flex-shrink-0">
                <div className="absolute inset-0 rounded-full blur-3xl pointer-events-none" style={{
                  background: orbMode === 'critical' ? 'rgba(239,68,68,0.4)' : orbMode === 'listening' ? 'rgba(249,115,22,0.3)' : 'rgba(6,182,212,0.25)',
                  transform: 'scale(1.4)', opacity: 0.18, transition: 'background 1s ease',
                }} />
                <ClaudiaOrb mode={orbMode} size={480} />
              </div>

              <div className={`text-[10px] font-bold uppercase tracking-[0.35em] transition-colors duration-700 ${ORB_COLOR[orbMode]}`}>
                {ORB_LABEL[orbMode]}
              </div>

              {(waveActive || orbMode === 'listening') && <Waveform active={waveActive || orbMode === 'listening'} />}

              {/* Live transcript card — shown prominently in center during demo */}
              {demoRunning && (transcript.length > 0 || transcriptFull) && (
                <div className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl"
                  style={{
                    background: 'rgba(6,8,13,0.96)',
                    backdropFilter: 'blur(32px)',
                    border: '1px solid rgba(6,182,212,0.35)',
                    boxShadow: '0 0 32px rgba(6,182,212,0.10)',
                  }}>
                  <div className="flex items-center gap-2 px-5 py-3"
                    style={{ borderBottom: '1px solid rgba(6,182,212,0.15)', background: 'rgba(6,182,212,0.07)' }}>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Live Call</span>
                    <span className="ml-auto text-[9px] text-zinc-400">Westbrook Academy</span>
                    <Waveform active={waveActive} />
                  </div>
                  <div className="px-5 py-4">
                    <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Transcript</div>
                    <p className="text-sm text-zinc-100 leading-relaxed">
                      {transcript}
                      {!transcriptFull && transcript.length > 0 && (
                        <span className="inline-block w-0.5 h-4 bg-cyan-400 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                      {transcriptFull && <span className="text-cyan-400 ml-2 text-[11px]">✓ complete</span>}
                    </p>
                  </div>
                  {transcript.length > 0 && (
                    <div className="px-5 pb-4">
                      <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(95, (transcript.split(' ').length / DEMO_WORDS.length) * 100)}%`, background: 'linear-gradient(90deg, #06b6d4, #3b82f6)' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pipeline */}
              {demoRunning && pipelineStep >= 0 && (
                <div className="w-full max-w-2xl rounded-lg px-4 py-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-[var(--muted)] mb-3">Processing Pipeline</div>
                  <PipelineVisualizer
                    activeStep={pipelineStep < PIPELINE_STEPS.length ? pipelineStep : PIPELINE_STEPS.length}
                    stepTimes={stepTimes}
                    demoStartMs={demoStart.current}
                  />
                </div>
              )}
            </div>

            {/* Right: live feed */}
            <div className="flex flex-col w-80 xl:w-88 shrink-0 border-l min-h-0"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <div className="px-4 pt-4 pb-3 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Live Feed</span>
                  <span className="text-[10px] text-[var(--muted)] font-mono tabular-nums">{filtered.length}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { k: 'all', l: 'All' },
                    { k: 'critical', l: 'Critical', dot: 'text-red-400' },
                    { k: 'high', l: 'High', dot: 'text-orange-400' },
                    { k: 'weapon', l: 'Weapon' },
                  ].map(f => (
                    <button key={f.k} onClick={() => setFilter(f.k)}
                      className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                        filter === f.k ? 'bg-[var(--foreground)] text-[var(--background)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}>
                      {f.dot && <span className={f.dot}>• </span>}{f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 min-h-0">
                {loading ? (
                  [...Array(4)].map((_, i) => <TipRowSkeleton key={i} />)
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-2.5 text-center py-12">
                    <div className="text-2xl opacity-20">📡</div>
                    <div className="text-xs text-zinc-400">No tips yet</div>
                    <div className="text-[10px] text-zinc-400 max-w-[140px] leading-relaxed">Logs appear in real time as calls come in</div>
                  </div>
                ) : (
                  filtered.map(tip => (
                    <TipRow key={tip.id} tip={tip} allTips={tips} onClick={() => setSelected(tip)} fresh={freshIds.has(tip.id)} onAnalyze={t => setAnalysisTip(t)} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Threat Intelligence (3D graph) ── */}
        {activeTab === 'intelligence' && (
          <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
            <ThreatGraph tips={realTips} freshIds={freshIds} />
          </div>
        )}

        {/* ── Tab: Data Pipeline ── */}
        {activeTab === 'pipeline' && (
          <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
            <PipelineView />
          </div>
        )}

      </div>

      {selected && (
        <TipDrawer
          tip={selected}
          onClose={() => setSelected(null)}
          onStatusChange={updateTipStatus}
          onAnalyze={tip => { setSelected(null); setAnalysisTip(tip) }}
        />
      )}
    </>
  )
}
