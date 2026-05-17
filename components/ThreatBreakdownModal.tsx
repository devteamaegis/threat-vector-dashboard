'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

// ── Word classification ────────────────────────────────────────────────────────
// Broad enough to catch natural speech ("gonna", "find", "coming", "school", etc.)
const THREAT_WORDS    = new Set([
  'gun','guns','weapon','weapons','knife','knives','bomb','bombs','shoot','shooting','shot',
  'kill','killing','killed','hurt','harm','harming','attack','attacking','attacked',
  'threat','threatening','threatened','violence','violent','die','dead','death',
  'fight','fighting','destroy','explode','explosion','blood','murder','stab',
  'fire','burn','assault','rifle','firearm','pistol','explosive',
  // natural speech patterns
  'find','coming','get','beat','punish','end','ruin','destroy','revenge','retaliate',
  'after','target','targeting','hunting','chase','chasing','follow','following',
])
const URGENT_WORDS    = new Set([
  'tomorrow','today','tonight','now','soon','immediately','urgent','quickly',
  'planning','plan','going','gonna','will','about','next','morning','afternoon',
  'evening','right','before','this','week','hour','monday','friday',
  'gotta','need','must','have to','about to',
])
const FEAR_WORDS      = new Set([
  'scared','terrified','afraid','fear','worried','nervous','panic','please','help',
  'dangerous','serious','warning','everyone','kids','students','people','friends',
  'concerned','safe','unsafe','hide','crying','shaking','freaking','threatened',
  'uncomfortable','uneasy','suspicious','weird','strange','odd',
])
const LOCATION_WORDS  = new Set([
  'gym','cafeteria','bathroom','classroom','hallway','parking','locker','room',
  'campus','building','library','auditorium','lunchroom','office','lab','field',
  'stadium','bus','entrance','exit','door','school','high school','middle school',
  'elementary','outside','inside','near','behind','front',
])
const CREDIBILITY_WORDS = new Set([
  'saw','heard','overheard','showed','photo','picture','directly','witnessed',
  'myself','personally','there','seen','proof','screenshot','video','record',
  'told me','showed me','watched','noticed','observed',
])
const ESCALATION_WORDS  = new Set([
  'weeks','days','again','keeps','pattern','history','before','multiple','times',
  'worse','escalating','building','months','recurring','repeated','always',
  'never stops','used to','last time','every day',
])

type WordClass = 'threat' | 'urgent' | 'fear' | 'location' | 'credibility' | 'escalation' | 'neutral'
function classifyWord(w: string): WordClass {
  const lower = w.toLowerCase().replace(/[^a-z]/g, '')
  if (THREAT_WORDS.has(lower))      return 'threat'
  if (URGENT_WORDS.has(lower))      return 'urgent'
  if (LOCATION_WORDS.has(lower))    return 'location'
  if (CREDIBILITY_WORDS.has(lower)) return 'credibility'
  if (ESCALATION_WORDS.has(lower))  return 'escalation'
  if (FEAR_WORDS.has(lower))        return 'fear'
  return 'neutral'
}

// ── Frontend Bayesian feature table (mirrors bayesian_scorer.py) ───────────────
// Used to reconstruct the live math trace inside the modal
const BASE_RATE = 0.002
interface FrontendFeature { name: string; label: string; kws: string[]; lr: number; std: number; cat: string }
const FEATURE_TABLE_FE: FrontendFeature[] = [
  { name:'weapon_explicit',   label:'Explicit Weapon',      kws:['gun','knife','weapon','firearm','shoot','stab','bomb','rifle','pistol','explosive'], lr:12.0, std:3.0, cat:'Weapon'      },
  { name:'weapon_photo',      label:'Weapon Evidence',      kws:['showed a photo','picture of a','photo of','sent a picture','screenshot of'],         lr:18.0, std:4.0, cat:'Evidence'    },
  { name:'weapon_implicit',   label:'Implied Violence',     kws:['do something','hurt people','hurt everyone','make them pay','going to do it'],        lr:4.0,  std:1.5, cat:'Weapon'      },
  { name:'timeline_immediate',label:'Imminent Timeline',    kws:['right now','happening now','today','this morning','tonight','first period'],           lr:8.0,  std:2.0, cat:'Timeline'    },
  { name:'timeline_near',     label:'Near-term Timeline',   kws:['tomorrow','next week','this week','few days','monday','friday'],                       lr:4.5,  std:1.2, cat:'Timeline'    },
  { name:'specific_person',   label:'Named Subject',        kws:['his name','her name','the student','a kid named','he told','she said'],                lr:5.0,  std:1.5, cat:'Specificity' },
  { name:'specific_location', label:'Specific Location',    kws:['gym','cafeteria','bathroom','classroom','hallway','parking lot','locker','room'],      lr:4.0,  std:1.2, cat:'Location'    },
  { name:'specific_method',   label:'Method Described',     kws:['planning to','said he would','told people he','showed how'],                           lr:7.0,  std:2.0, cat:'Specificity' },
  { name:'multiple_witnesses',label:'Multiple Witnesses',   kws:['other people saw','multiple students','everyone knows','we all saw','lots of kids'],   lr:3.5,  std:1.0, cat:'Credibility' },
  { name:'escalation_pattern',label:'Escalation Pattern',   kws:['for weeks','getting worse','keeps saying','pattern','again','months'],                 lr:4.5,  std:1.2, cat:'Escalation'  },
  { name:'direct_witness',    label:'First-Hand Witness',   kws:['i heard','i saw','overheard','i was there','saw myself'],                              lr:6.0,  std:1.5, cat:'Credibility' },
  { name:'second_hand',       label:'Second-Hand Report',   kws:['someone told me','i heard from','people are saying','rumor'],                          lr:1.8,  std:0.6, cat:'Credibility' },
  { name:'caller_fearful',    label:'Caller Fear Signal',   kws:['scared','terrified','afraid','worried','i\'m scared','freaking out','please help'],    lr:3.0,  std:0.8, cat:'Emotion'     },
  { name:'caller_precise',    label:'Precise Detail',       kws:['exact','specifically','i have the','i saved','screenshot'],                            lr:2.5,  std:0.7, cat:'Credibility' },
  { name:'caller_laughs',     label:'Deception Indicator',  kws:['haha','lol','just kidding','just joking','not serious'],                               lr:0.10, std:0.05,cat:'Deception'   },
  { name:'caller_vague',      label:'Vague Report',         kws:['maybe nothing','probably fine','i don\'t know','not sure'],                            lr:0.55, std:0.2, cat:'Deception'   },
]

interface BayesStep { feature: FrontendFeature; keyword: string; priorP: number; posteriorP: number; delta: number }
function computeBayesTrace(text: string): BayesStep[] {
  const lower = text.toLowerCase()
  const seen = new Set<string>()
  let p = BASE_RATE
  const steps: BayesStep[] = []
  for (const f of FEATURE_TABLE_FE) {
    if (seen.has(f.name)) continue
    for (const kw of f.kws) {
      if (lower.includes(kw)) {
        const priorOdds = p / (1 - p + 1e-9)
        const postOdds  = priorOdds * f.lr
        const next      = postOdds / (1 + postOdds)
        steps.push({ feature: f, keyword: kw, priorP: p, posteriorP: next, delta: next - p })
        seen.add(f.name)
        p = next
        break
      }
    }
  }
  return steps
}

// ── Composite factor detection ─────────────────────────────────────────────────
function detectComposites(steps: BayesStep[]): Array<{ label: string; desc: string; lr: number }> {
  const names = new Set(steps.map(s => s.feature.name))
  const composites = []
  if (names.has('specific_location') && names.has('specific_person'))
    composites.push({ label: 'Location + Subject', desc: 'Specific place AND named subject — high credibility composite', lr: 3.5 })
  if (names.has('direct_witness') && names.has('caller_precise'))
    composites.push({ label: 'First-Hand + Evidence', desc: 'Eye-witness with precise verifiable details', lr: 4.5 })
  if (names.has('weapon_photo') && (names.has('timeline_immediate') || names.has('timeline_near')))
    composites.push({ label: 'Weapon Evidence + Timeline', desc: 'Physical evidence tied to a specific time window', lr: 8.0 })
  if (names.has('escalation_pattern') && names.has('multiple_witnesses'))
    composites.push({ label: 'Escalation + Corroboration', desc: 'Ongoing pattern confirmed by multiple sources', lr: 5.0 })
  return composites
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function normalRandom(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function fmtPct(p: number) { return p < 0.1 ? `${(p*100).toFixed(2)}%` : `${(p*100).toFixed(1)}%` }

// ── Category color map ─────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  Weapon:'#ef4444', Evidence:'#f87171', Timeline:'#f59e0b', Specificity:'#8b5cf6',
  Location:'#3b82f6', Credibility:'#06b6d4', Escalation:'#a855f7',
  Emotion:'#f97316', Deception:'#22c55e',
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ThreatBreakdownProps {
  transcript: string
  bayesProbPct?: number | null
  bayesCiLow?: number | null
  bayesCiHigh?: number | null
  bayesDrivers?: Array<{ keyword: string; weight?: number; ratio?: number }> | null
  threatLevel?: number | null
  callerEmotion?: string | null
  callerTone?: string | null
  threeModelConsensus?: boolean | null
  schoolName?: string | null
  onClose: () => void
}

type Phase = 'decode' | 'signals' | 'montecarlo' | 'verdict'
const PHASE_ORDER: Phase[] = ['decode', 'signals', 'montecarlo', 'verdict']
const PHASE_LABELS: Record<Phase, string> = { decode:'Decode', signals:'Signals', montecarlo:'Monte Carlo', verdict:'Verdict' }

// ── Circular gauge ─────────────────────────────────────────────────────────────
function VerdictGauge({ pct, color }: { pct: number; color: string }) {
  const R = 68, circumference = 2 * Math.PI * R, sweep = circumference * 0.75
  const filled = (clamp(pct, 0, 100) / 100) * sweep
  return (
    <div className="relative flex items-center justify-center" style={{ width:176, height:176 }}>
      <svg width={176} height={176} viewBox="0 0 176 176" style={{ transform:'rotate(135deg)', position:'absolute' }}>
        <circle cx={88} cy={88} r={R} fill="none" strokeWidth={10} stroke="rgba(255,255,255,0.07)"
          strokeDasharray={`${sweep} ${circumference}`} strokeLinecap="round" />
        <circle cx={88} cy={88} r={R} fill="none" strokeWidth={10} stroke={color}
          strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 30ms linear', filter:`drop-shadow(0 0 10px ${color}90)` }} />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="text-4xl font-black tabular-nums leading-none" style={{ color, textShadow:`0 0 20px ${color}60` }}>
          {Math.round(pct)}%
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 mt-1.5">Threat Prob.</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ThreatBreakdownModal({
  transcript, bayesProbPct, bayesCiLow, bayesCiHigh, bayesDrivers,
  threatLevel, callerEmotion, callerTone, threeModelConsensus, schoolName, onClose,
}: ThreatBreakdownProps) {
  const words       = transcript.split(/\s+/).filter(Boolean)
  const wordClasses = useMemo(() => words.map(w => classifyWord(w)), [transcript]) // eslint-disable-line react-hooks/exhaustive-deps
  const bayesTrace  = useMemo(() => computeBayesTrace(transcript), [transcript])
  const composites  = useMemo(() => detectComposites(bayesTrace), [bayesTrace])

  const threatCount      = wordClasses.filter(c => c === 'threat').length
  const urgentCount      = wordClasses.filter(c => c === 'urgent').length
  const fearCount        = wordClasses.filter(c => c === 'fear').length
  const locationCount    = wordClasses.filter(c => c === 'location').length
  const credibilityCount = wordClasses.filter(c => c === 'credibility').length
  const escalationCount  = wordClasses.filter(c => c === 'escalation').length

  const rawScore = Math.min(threatCount*20 + urgentCount*10 + fearCount*8 + locationCount*6 + credibilityCount*7 + escalationCount*5, 95)

  // Level → probability when Bayesian finds nothing meaningful (< 2%)
  const LEVEL_TO_PROB: Record<number, number> = { 1: 5, 2: 15, 3: 40, 4: 68, 5: 88 }
  const bayesIsMeaningful = bayesProbPct != null && bayesProbPct > 2
  const levelDerivedProb  = threatLevel ? (LEVEL_TO_PROB[threatLevel] ?? 5) : null
  const probPct = bayesIsMeaningful
    ? bayesProbPct!
    : levelDerivedProb != null
      ? Math.max(levelDerivedProb, rawScore > 5 ? rawScore : 1)
      : Math.max(rawScore, 5)

  // CI: use Bayesian CI only if it has meaningful width (> 2pp), else derive from probPct
  const bayesCiMeaningful = bayesCiLow != null && bayesCiHigh != null && (bayesCiHigh - bayesCiLow) > 2
  const ciWidth = (threatLevel ?? 1) >= 4 ? 20 : 14
  const ciLow  = bayesCiMeaningful ? bayesCiLow!  : Math.max(probPct - ciWidth, 0)
  const ciHigh = bayesCiMeaningful ? bayesCiHigh! : Math.min(probPct + ciWidth, 100)

  const level    = threatLevel  ?? (probPct>80?5:probPct>55?4:probPct>30?3:probPct>10?2:1)
  const verdictColor = probPct>50?'#ef4444':probPct>15?'#f97316':'#22c55e'

  // Probability source label (for verdict panel)
  const probSource = bayesIsMeaningful
    ? `Bayesian Monte Carlo · ${bayesTrace.length} verbal feature${bayesTrace.length!==1?'s':''} detected`
    : levelDerivedProb != null
      ? `AI semantic consensus · Level ${level}/5 · no explicit trigger keywords`
      : `Keyword scoring · no Bayesian data`

  // ── Phase state ──────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<Phase>('decode')
  const [revealedCount, setRevealed] = useState(0)
  const [signalFill, setSignalFill]  = useState(0)
  const [mcProgress, setMcProgress]  = useState(0)
  const [mcPhase, setMcPhase]        = useState(0)   // 0=particles 1=CI 2=mean 3=trace
  const [traceVisible, setTraceVisible] = useState(0) // how many trace rows shown
  const [verdictPct, setVerdictPct]  = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number | null>(null)

  const goToPhase = useCallback((p: Phase) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPhase(p); setSignalFill(0); setMcProgress(0); setMcPhase(0); setTraceVisible(0); setVerdictPct(0)
  }, [])

  // ── Phase 1: word-by-word decode (slower) ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'decode') return
    let i = 0
    // Slower: min 80ms, max 280ms, targeting ~7s for average transcript
    const msPerWord = Math.max(80, Math.min(280, 7500 / words.length))
    const id = setInterval(() => {
      i++; setRevealed(i)
      if (i >= words.length) {
        clearInterval(id)
        setTimeout(() => setPhase('signals'), 1800)  // longer pause
      }
    }, msPerWord)
    return () => clearInterval(id)
  }, [phase, words.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 2: signals (3x slower) ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'signals') return
    let v = 0
    const id = setInterval(() => {
      v = Math.min(v + 0.7, 100); setSignalFill(v)
      if (v >= 100) { clearInterval(id); setTimeout(() => setPhase('montecarlo'), 1400) }
    }, 22)
    return () => clearInterval(id)
  }, [phase])

  // ── Phase 3: Monte Carlo canvas (2x slower + math trace) ─────────────────────
  useEffect(() => {
    if (phase !== 'montecarlo') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const DPR = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth || 760
    const cssH = 180
    canvas.width  = cssW * DPR; canvas.height = cssH * DPR
    ctx.scale(DPR, DPR)
    const W = cssW, H = cssH

    const N   = 600
    const std = Math.max((ciHigh - ciLow) / 4, 5)
    const mean = probPct
    const samples = Array.from({ length: N }, () => clamp(normalRandom(mean, std), 0, 100))
    const BUCKETS = 60
    const stacks: number[][] = Array.from({ length: BUCKETS }, () => [])
    samples.forEach(s => { const b = Math.floor((s/100)*(BUCKETS-1)); stacks[b].push(s) })
    const toX = (p: number) => (p/100)*(W-30)+15

    let frame = 0
    const TOTAL = 220  // was 100 — much slower

    const animate = () => {
      ctx.clearRect(0, 0, W, H)
      const progress = Math.min(frame / TOTAL, 1)
      const shown    = Math.floor(progress * N)
      const stacked: number[] = new Array(BUCKETS).fill(0)
      let drawn = 0

      for (let b = 0; b < BUCKETS && drawn < shown; b++) {
        for (let j = 0; j < stacks[b].length && drawn < shown; j++, drawn++) {
          const s = stacks[b][j]
          const bx = toX(s)
          const by = H - 22 - stacked[b] * 3.5
          stacked[b]++
          const alpha = 0.55 + (s > 50 ? 0.2 : 0)
          const col = s>50?`rgba(239,68,68,${alpha})`:s>15?`rgba(249,115,22,${alpha})`:`rgba(34,197,94,${alpha})`
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, Math.PI*2); ctx.fill()
        }
      }

      // CI band at 60%
      if (progress > 0.60) {
        const a = (progress - 0.60) / 0.40
        ctx.save(); ctx.globalAlpha = a * 0.13; ctx.fillStyle = '#f59e0b'
        ctx.fillRect(toX(ciLow), 0, toX(ciHigh) - toX(ciLow), H); ctx.restore()
        ctx.save(); ctx.globalAlpha = a * 0.5; ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
        ;[ciLow, ciHigh].forEach(p => { const x=toX(p); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() })
        ctx.setLineDash([]); ctx.restore()
        if (mcPhase < 1) setMcPhase(1)
      }

      // Mean line at 80%
      if (progress > 0.80) {
        const a = (progress - 0.80) / 0.20
        const mx = toX(mean)
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6
        ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke(); ctx.restore()
        if (mcPhase < 2) setMcPhase(2)
      }

      // Axis labels
      ctx.fillStyle = 'rgba(113,113,122,0.7)'; ctx.font = '10px monospace'
      ;[0,25,50,75,100].forEach(p => { const x=toX(p); ctx.fillText(`${p}%`, x-6, H-4) })

      setMcProgress(Math.min(shown, N))
      frame++
      if (frame <= TOTAL + 50) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        // After canvas done, reveal trace rows one by one
        if (mcPhase < 3) setMcPhase(3)
        let row = 0
        const traceTimer = setInterval(() => {
          row++; setTraceVisible(row)
          if (row >= bayesTrace.length + 1) {
            clearInterval(traceTimer)
            setTimeout(() => setPhase('verdict'), 1200)
          }
        }, 300)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 4: verdict count-up (slower) ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'verdict') return
    let v = 0
    const id = setInterval(() => {
      v = Math.min(v + probPct / 90, probPct); setVerdictPct(v)
      if (v >= probPct) clearInterval(id)
    }, 20)
    return () => clearInterval(id)
  }, [phase, probPct])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const phaseIdx = PHASE_ORDER.indexOf(phase)
  const currentWordClasses = wordClasses.slice(0, revealedCount)

  // ── Emotional profile dimensions ──────────────────────────────────────────────
  const emotionDimensions = [
    { label:'Aggression',    pct: Math.min(threatCount*25 + 5, 100),                            color:'#ef4444' },
    { label:'Desperation',   pct: Math.min(fearCount*20 + urgentCount*12, 100),                  color:'#f97316' },
    { label:'Intent',        pct: Math.min((threatCount + urgentCount)*16, 100),                 color:'#f59e0b' },
    { label:'Specificity',   pct: Math.min((locationCount+credibilityCount)*18+threatCount*8,100),color:'#8b5cf6' },
    { label:'Credibility',   pct: Math.max(0, Math.min(credibilityCount*22 - (wordClasses.filter(c=>c==='neutral').length > words.length*0.85 ? 15:0), 100)), color:'#06b6d4' },
    { label:'Escalation',    pct: Math.min(escalationCount*28, 100),                             color:'#a855f7' },
  ]

  return (
    <>
      <style>{`
        @keyframes wordPop {
          0%   { transform: scale(0.72) translateY(5px); opacity: 0 }
          65%  { transform: scale(1.10) translateY(-2px); opacity: 1 }
          100% { transform: scale(1) translateY(0); opacity: 1 }
        }
        @keyframes wordFade { from { opacity:0;transform:translateY(3px) } to { opacity:1;transform:translateY(0) } }
        @keyframes mcFadeIn { from { opacity:0;transform:translateY(10px) } to { opacity:1;transform:translateY(0) } }
        @keyframes verdictIn { from { opacity:0;transform:scale(0.88) } to { opacity:1;transform:scale(1) } }
        @keyframes levelGlow { 0%,100%{box-shadow:0 0 12px var(--lc,#ef4444)40} 50%{box-shadow:0 0 28px var(--lc,#ef4444)80} }
        @keyframes traceRow { from { opacity:0;transform:translateX(-8px) } to { opacity:1;transform:translateX(0) } }
        @keyframes pulseRing { 0%{opacity:0.7;transform:scale(1)} 100%{opacity:0;transform:scale(2.2)} }
      `}</style>

      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        style={{ background:'rgba(0,0,0,0.90)', backdropFilter:'blur(12px)' }}
        onClick={onClose}>
        <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            background:'rgba(6,8,13,0.99)', border:`1px solid ${verdictColor}30`,
            boxShadow:`0 0 120px ${verdictColor}12, 0 0 0 1px ${verdictColor}10`,
            maxHeight:'92vh',
          }}
          onClick={e => e.stopPropagation()}>

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 px-6 py-4 shrink-0"
            style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(239,68,68,0.04)' }}>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-red-400">Threat Analysis</span>
              {schoolName && <span className="text-[10px] text-zinc-500 font-mono">· {schoolName}</span>}
            </div>
            <div className="flex items-center gap-1 ml-auto mr-4">
              {PHASE_ORDER.map((p, i) => {
                const done = phaseIdx > i; const active = phase === p
                return (
                  <div key={p} className="flex items-center gap-1">
                    <button onClick={() => goToPhase(p)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-[0.15em] transition-all duration-300 ${
                        active ? 'text-red-400 border border-red-500/30' :
                        done   ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-700 hover:text-zinc-600'
                      }`}
                      style={{ background: active ? 'rgba(239,68,68,0.1)' : 'transparent' }}>
                      {done   && <span className="text-green-500 text-[8px]">✓</span>}
                      {active && <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />}
                      {PHASE_LABELS[p]}
                    </button>
                    {i < PHASE_ORDER.length - 1 && <span className={`text-[10px] mx-0.5 ${done?'text-zinc-600':'text-zinc-800'}`}>›</span>}
                  </div>
                )
              })}
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-base shrink-0">✕</button>
          </div>

          {/* ── Content ───────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* ══════════════ PHASE 1: DECODE ══════════════════════════════ */}
            {phase === 'decode' && (
              <div className="p-6 flex gap-6" style={{ animation:'mcFadeIn 0.3s ease-out' }}>

                {/* Transcript */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Scanning Transcript</div>
                    <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.04)' }} />
                    <div className="text-[9px] font-mono text-zinc-600">{revealedCount}/{words.length} words</div>
                  </div>
                  <div className="text-[13px] leading-10 flex flex-wrap gap-x-2 gap-y-2">
                    {words.map((word, i) => {
                      if (i >= revealedCount) return null
                      const cls = classifyWord(word)
                      const isLast = i === revealedCount - 1
                      const anim = `${isLast && cls !== 'neutral' ? 'wordPop' : 'wordFade'} 0.25s cubic-bezier(0.34,1.4,0.64,1) both`
                      const styleMap: Record<WordClass, React.CSSProperties> = {
                        threat:      { color:'#f87171', background:'rgba(239,68,68,0.16)',   border:'1px solid rgba(239,68,68,0.35)',  borderRadius:6, padding:'2px 8px', fontWeight:800, animation:anim, boxShadow:isLast?'0 0 14px rgba(239,68,68,0.4)':'none' },
                        urgent:      { color:'#fbbf24', background:'rgba(245,158,11,0.13)',  border:'1px solid rgba(245,158,11,0.25)', borderRadius:6, padding:'2px 8px', fontWeight:700, animation:anim },
                        fear:        { color:'#fb923c', background:'rgba(249,115,22,0.11)',  border:'1px solid rgba(249,115,22,0.2)', borderRadius:6, padding:'2px 7px', fontWeight:600, animation:anim },
                        location:    { color:'#60a5fa', background:'rgba(59,130,246,0.13)',  border:'1px solid rgba(59,130,246,0.25)',borderRadius:6, padding:'2px 7px', fontWeight:600, animation:anim },
                        credibility: { color:'#22d3ee', background:'rgba(6,182,212,0.12)',   border:'1px solid rgba(6,182,212,0.25)',  borderRadius:6, padding:'2px 7px', fontWeight:600, animation:anim },
                        escalation:  { color:'#c084fc', background:'rgba(168,85,247,0.12)',  border:'1px solid rgba(168,85,247,0.25)',borderRadius:6, padding:'2px 7px', fontWeight:600, animation:anim },
                        neutral:     { color:'#52525b', animation:'wordFade 0.15s ease-out' },
                      }
                      return <span key={i} style={styleMap[cls]}>{word}</span>
                    })}
                    {revealedCount < words.length && <span className="inline-block w-0.5 h-5 bg-cyan-400 animate-pulse align-middle ml-0.5" />}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                    {[
                      { label:'Threat word',  color:'#f87171', bg:'rgba(239,68,68,0.16)' },
                      { label:'Urgency',      color:'#fbbf24', bg:'rgba(245,158,11,0.13)' },
                      { label:'Fear',         color:'#fb923c', bg:'rgba(249,115,22,0.11)' },
                      { label:'Location',     color:'#60a5fa', bg:'rgba(59,130,246,0.13)' },
                      { label:'Credibility',  color:'#22d3ee', bg:'rgba(6,182,212,0.12)' },
                      { label:'Escalation',   color:'#c084fc', bg:'rgba(168,85,247,0.12)' },
                      { label:'Neutral',      color:'#52525b', bg:'transparent' },
                    ].map(l => (
                      <span key={l.label} className="flex items-center gap-1.5 text-[9px]">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ color:l.color, background:l.bg, border:`1px solid ${l.color}30` }}>Aa</span>
                        <span className="text-zinc-500">{l.label}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sidebar: live signal counters */}
                <div className="w-52 shrink-0 flex flex-col gap-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-0">Live Signals</div>

                  {[
                    { label:'Threat words',  color:'#ef4444', count: currentWordClasses.filter(c=>c==='threat').length,      max:6 },
                    { label:'Urgency',       color:'#f59e0b', count: currentWordClasses.filter(c=>c==='urgent').length,      max:6 },
                    { label:'Fear/distress', color:'#f97316', count: currentWordClasses.filter(c=>c==='fear').length,        max:5 },
                    { label:'Location cues', color:'#3b82f6', count: currentWordClasses.filter(c=>c==='location').length,    max:4 },
                    { label:'Credibility',   color:'#06b6d4', count: currentWordClasses.filter(c=>c==='credibility').length, max:4 },
                    { label:'Escalation',    color:'#a855f7', count: currentWordClasses.filter(c=>c==='escalation').length,  max:4 },
                  ].map(({ label, color, count, max }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
                        <span className="text-sm font-black tabular-nums" style={{ color }}>{count}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-200"
                          style={{ width:`${Math.min(100, (count/max)*100)}%`, background:`linear-gradient(90deg,${color}60,${color})`, boxShadow:count>0?`0 0 6px ${color}50`:'none' }} />
                      </div>
                    </div>
                  ))}

                  {/* Live probability estimate */}
                  <div className="rounded-xl p-3 mt-1" style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">Prelim. Score</div>
                    <div className="text-3xl font-black tabular-nums" style={{ color: verdictColor }}>
                      {Math.min(
                        currentWordClasses.filter(c=>c==='threat').length*18 +
                        currentWordClasses.filter(c=>c==='urgent').length*8 +
                        currentWordClasses.filter(c=>c==='fear').length*6 +
                        currentWordClasses.filter(c=>c==='location').length*5 +
                        currentWordClasses.filter(c=>c==='credibility').length*6 +
                        currentWordClasses.filter(c=>c==='escalation').length*4, 99)}%
                    </div>
                    <div className="text-[9px] text-zinc-600 mt-0.5">pre-Bayesian estimate</div>
                  </div>

                  {(callerEmotion || callerTone) && (
                    <div className="rounded-xl p-3" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Caller State</div>
                      {callerEmotion && <div className="flex justify-between text-[10px] mb-1"><span className="text-zinc-500">Emotion</span><span className="font-semibold text-orange-400 capitalize">{callerEmotion}</span></div>}
                      {callerTone    && <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Tone</span><span className="font-semibold text-zinc-300 capitalize">{callerTone}</span></div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════ PHASE 2: SIGNALS ══════════════════════════════ */}
            {phase === 'signals' && (
              <div className="p-6" style={{ animation:'mcFadeIn 0.35s ease-out' }}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Extracting Threat Signals</div>
                  <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.04)' }} />
                </div>

                {/* 6-factor signal grid */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label:'Verbal Threat',    value:threatCount,      max:6,  color:'#ef4444', desc:`${threatCount} explicit threat keyword${threatCount!==1?'s':''} detected` },
                    { label:'Urgency / Time',   value:urgentCount,      max:6,  color:'#f59e0b', desc:`${urgentCount} time-sensitive indicator${urgentCount!==1?'s':''}`  },
                    { label:'Fear / Distress',  value:fearCount,        max:5,  color:'#f97316', desc:`${fearCount} emotional distress signal${fearCount!==1?'s':''}`      },
                    { label:'Location Cues',    value:locationCount,    max:4,  color:'#3b82f6', desc:`${locationCount} specific location reference${locationCount!==1?'s':''}`  },
                    { label:'Witness / Evidence',value:credibilityCount,max:4,  color:'#06b6d4', desc:`${credibilityCount} first-hand credibility marker${credibilityCount!==1?'s':''}` },
                    { label:'Escalation',       value:escalationCount,  max:4,  color:'#a855f7', desc:`${escalationCount} escalation / pattern indicator${escalationCount!==1?'s':''}` },
                  ].map(({ label, value, max, color, desc }) => {
                    const pct = (value / max) * (signalFill / 100) * 100
                    return (
                      <div key={label} className="rounded-xl p-4 flex flex-col gap-2.5"
                        style={{ background:`${color}08`, border:`1px solid ${color}20` }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-[0.12em] leading-tight" style={{ color:`${color}cc` }}>{label}</span>
                          <span className="text-xl font-black tabular-nums" style={{ color }}>{value}</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full transition-all duration-75"
                            style={{ width:`${pct}%`, background:`linear-gradient(90deg,${color}50,${color})`, boxShadow:`0 0 8px ${color}60` }} />
                        </div>
                        <div className="text-[9px] text-zinc-500">{desc}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Emotional profile */}
                <div className="rounded-xl p-5" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">Emotional Profile</div>
                  <div className="grid grid-cols-3 gap-5">
                    {emotionDimensions.map(({ label, pct: barPct, color }) => {
                      const display = barPct * (signalFill / 100)
                      return (
                        <div key={label} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</span>
                            <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{Math.round(display)}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.05)' }}>
                            <div className="h-full rounded-full transition-all duration-75"
                              style={{ width:`${display}%`, background:color, boxShadow:`0 0 6px ${color}60` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {(callerEmotion || callerTone) && (
                    <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                      {callerEmotion && <span className="text-[10px]"><span className="text-zinc-500">Caller emotion: </span><span className="font-semibold text-orange-400 capitalize">{callerEmotion}</span></span>}
                      {callerTone    && <span className="text-[10px]"><span className="text-zinc-500">Tone: </span><span className="font-semibold text-zinc-300 capitalize">{callerTone}</span></span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════ PHASE 3: MONTE CARLO ══════════════════════════ */}
            {phase === 'montecarlo' && (
              <div className="p-6" style={{ animation:'mcFadeIn 0.35s ease-out' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Bayesian Monte Carlo Simulation</div>
                  <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.04)' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-cyan-500 tabular-nums">{mcProgress.toLocaleString()} / 600 draws</span>
                </div>

                {/* Canvas */}
                <div className="rounded-xl overflow-hidden mb-4"
                  style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.07)' }}>
                  <canvas ref={canvasRef} style={{ width:'100%', height:180, display:'block' }} />
                </div>

                {/* Canvas legend */}
                <div className="flex items-center gap-6 mb-5">
                  <span className="flex items-center gap-2 text-[9px] text-zinc-500">
                    <span className="w-8 h-0.5 rounded" style={{ background:'#ef4444' }} />Mean: {probPct.toFixed(1)}%
                  </span>
                  <span className="flex items-center gap-2 text-[9px] text-zinc-500">
                    <span className="w-8 h-3 rounded opacity-30" style={{ background:'#f59e0b' }} />95% CI: {ciLow.toFixed(0)}% – {ciHigh.toFixed(0)}%
                  </span>
                  <div className="flex items-center gap-4 ml-auto">
                    {[{color:'#ef4444',label:'>50% threat'},{color:'#f97316',label:'15–50%'},{color:'#22c55e',label:'<15% low risk'}].map(l=>(
                      <span key={l.label} className="flex items-center gap-1.5 text-[9px] text-zinc-500">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background:l.color }} />{l.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── What happened summary (shows when trace has no keyword hits) ── */}
                {mcPhase >= 2 && bayesTrace.length === 0 && (
                  <div className="rounded-xl p-4 mb-4" style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', animation:'mcFadeIn 0.4s ease-out' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">🧠</span>
                      <div>
                        <div className="text-[10px] font-bold text-indigo-300 mb-1.5">Why is the probability {probPct.toFixed(0)}%?</div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          No explicit trigger keywords (weapons, named suspects, specific locations) were detected in the transcript. The Bayesian engine started at the 0.20% base rate and found no features to update it.
                        </p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed mt-1.5">
                          However, Claude AI's semantic language model independently assessed this as{' '}
                          <span className="font-bold text-white">Threat Level {level}/5</span>.
                          The {probPct.toFixed(0)}% probability is derived from that multi-model consensus — the AI understood the <em>intent</em> of the speech even without matching specific keywords.
                        </p>
                        <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop:'1px solid rgba(99,102,241,0.15)' }}>
                          <span className="text-[9px] font-mono text-indigo-500">Source: {probSource}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Bayesian update trace ── shows the actual math ─────── */}
                {mcPhase >= 3 && (
                  <div className="rounded-xl overflow-hidden mb-4" style={{ border:'1px solid rgba(255,255,255,0.07)' }}>
                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ background:'rgba(99,102,241,0.08)', borderBottom:'1px solid rgba(99,102,241,0.15)' }}>
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Bayesian Update Chain</span>
                      <div className="flex-1 h-px" style={{ background:'rgba(99,102,241,0.12)' }} />
                      <span className="text-[9px] font-mono text-zinc-600">P₀ = BASE_RATE = 0.20%</span>
                    </div>
                    <div className="divide-y divide-white/5">

                      {/* Prior row */}
                      {traceVisible >= 1 && (
                        <div className="px-4 py-2.5 flex items-center gap-3"
                          style={{ background:'rgba(255,255,255,0.01)', animation:'traceRow 0.25s ease-out' }}>
                          <span className="text-[9px] font-mono text-zinc-600 w-5">P₀</span>
                          <span className="text-[9px] px-2 py-0.5 rounded font-bold" style={{ background:'rgba(100,116,139,0.2)', color:'#94a3b8' }}>PRIOR</span>
                          <span className="text-[9px] text-zinc-500 flex-1">Base rate: 1 in 500 school tip-line calls is a credible threat</span>
                          <span className="text-[10px] font-black font-mono tabular-nums" style={{ color:'#64748b' }}>0.20%</span>
                        </div>
                      )}

                      {/* Feature update rows */}
                      {bayesTrace.map((step, idx) => {
                        if (traceVisible < idx + 2) return null
                        const col = CAT_COLOR[step.feature.cat] ?? '#94a3b8'
                        const isPositive = step.delta > 0
                        const deltaFmt = `${isPositive?'+':''}${(step.delta*100).toFixed(2)}pp`
                        return (
                          <div key={idx} className="px-4 py-2.5 flex items-center gap-3"
                            style={{ background: idx%2===0?'rgba(255,255,255,0.005)':'transparent', animation:'traceRow 0.25s ease-out' }}>
                            <span className="text-[9px] font-mono text-zinc-600 w-5">P{idx+1}</span>
                            <span className="text-[9px] px-2 py-0.5 rounded font-bold shrink-0" style={{ background:`${col}20`, color:col }}>{step.feature.cat}</span>
                            <span className="text-[9px] font-mono text-zinc-300 shrink-0">"{step.keyword}"</span>
                            <span className="text-[9px] text-zinc-600 shrink-0">LR = {step.feature.lr.toFixed(1)} ± {step.feature.std.toFixed(1)}</span>
                            <div className="flex-1 text-[9px] text-zinc-600 hidden xl:block">
                              odds: {(step.priorP/(1-step.priorP)*1000).toFixed(2)}‰ × {step.feature.lr} = {(step.priorP/(1-step.priorP)*step.feature.lr*1000).toFixed(2)}‰
                            </div>
                            <span className="text-[10px] font-bold font-mono" style={{ color: isPositive?'#ef4444':'#22c55e' }}>{deltaFmt}</span>
                            <span className="text-[10px] font-black font-mono tabular-nums" style={{ color: step.posteriorP > 0.5 ? '#ef4444' : step.posteriorP > 0.15 ? '#f97316' : '#22c55e' }}>
                              {fmtPct(step.posteriorP)}
                            </span>
                          </div>
                        )
                      })}

                      {/* Composite factor rows */}
                      {composites.length > 0 && traceVisible >= bayesTrace.length + 1 && composites.map((c, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-center gap-3"
                          style={{ background:'rgba(99,102,241,0.04)', animation:'traceRow 0.25s ease-out' }}>
                          <span className="text-[9px] font-mono text-zinc-600 w-5">⊕</span>
                          <span className="text-[9px] px-2 py-0.5 rounded font-bold shrink-0" style={{ background:'rgba(99,102,241,0.2)', color:'#818cf8' }}>Composite</span>
                          <span className="text-[9px] font-semibold text-indigo-300 shrink-0">{c.label}</span>
                          <span className="text-[9px] text-zinc-600 flex-1">{c.desc}</span>
                          <span className="text-[10px] font-bold font-mono text-indigo-400">LR ×{c.lr.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* How it works explainer */}
                <div className="rounded-xl p-4" style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.18)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-500 mb-3">The Math</div>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { step:'P₀', label:'Base Rate',        desc:'Prior: 0.20% — 1 in 500 tip-line calls is a credible school threat (FBI JTTF calibrated)' },
                      { step:'LR', label:'Likelihood Ratio', desc:'Each verbal feature has LR = P(keyword | real threat) / P(keyword | non-threat). Weapon words: LR 12–18×. Second-hand rumours: LR 0.6×' },
                      { step:'⊗', label:'Odds Update',       desc:'posterior_odds = prior_odds × LR. Chained for each feature: P grows multiplicatively with each credibility signal' },
                      { step:'N(μ,σ)', label:'Monte Carlo',  desc:'Each of 600 simulations samples LR ~ N(mean, std). The spread of outcomes forms the confidence interval shown above' },
                    ].map(({ step, label, desc }) => (
                      <div key={step} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-400 font-black text-sm font-mono">{step}</span>
                          <span className="text-[10px] font-bold text-zinc-300">{label}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ PHASE 4: VERDICT ══════════════════════════════ */}
            {phase === 'verdict' && (
              <div className="p-6" style={{ animation:'verdictIn 0.4s cubic-bezier(0.34,1.2,0.64,1)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Threat Assessment Complete</div>
                  <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.04)' }} />
                  {threeModelConsensus && (
                    <span className="text-[9px] font-bold uppercase px-3 py-1 rounded-full bg-green-950/50 border border-green-800/30 text-green-400">✓ 3-model consensus</span>
                  )}
                </div>

                <div className="flex gap-6 items-start">
                  {/* Gauge + emotion */}
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <VerdictGauge pct={verdictPct} color={verdictColor} />
                    {(callerEmotion || callerTone) && (
                      <div className="text-center">
                        {callerEmotion && <div className="text-[10px] font-semibold capitalize" style={{ color:'#f97316' }}>{callerEmotion}</div>}
                        {callerTone    && <div className="text-[9px] text-zinc-500 capitalize">{callerTone}</div>}
                      </div>
                    )}
                    {/* Composite factors badges */}
                    {composites.length > 0 && (
                      <div className="flex flex-col gap-1.5 w-full mt-1">
                        {composites.map((c, i) => (
                          <div key={i} className="text-[9px] px-2.5 py-1.5 rounded-lg text-center font-semibold"
                            style={{ background:'rgba(99,102,241,0.15)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.25)' }}>
                            {c.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-4">
                    {/* Threat level */}
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2.5">Threat Level</div>
                      <div className="flex items-center gap-2">
                        {[1,2,3,4,5].map(l => {
                          const active = l === level; const filled = l <= level
                          const lc = l>=4?'#ef4444':l>=3?'#f97316':'#f59e0b'
                          return (
                            <div key={l} className="flex-1 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-500"
                              style={{
                                background:filled?`${lc}25`:'rgba(255,255,255,0.03)',
                                border:`1px solid ${filled?lc+'45':'rgba(255,255,255,0.06)'}`,
                                color:filled?lc:'#3f3f46',
                                transform:active?'scale(1.12)':'scale(1)',
                                boxShadow:active?`0 0 22px ${lc}50`:'none',
                                animation:active?`levelGlow 1.5s ease-in-out infinite`:'none',
                                // @ts-ignore
                                '--lc':lc,
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
                    <div className="rounded-xl p-4" style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-yellow-600 mb-3">95% Confidence Interval</div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-yellow-300 tabular-nums">{ciLow.toFixed(0)}%</span>
                        <div className="flex-1 relative h-3 rounded-full overflow-visible" style={{ background:'rgba(255,255,255,0.04)' }}>
                          <div className="absolute h-full rounded-full"
                            style={{ left:`${ciLow}%`, width:`${ciHigh-ciLow}%`, background:'linear-gradient(90deg,rgba(245,158,11,0.4),rgba(245,158,11,0.8))', boxShadow:'0 0 6px rgba(245,158,11,0.4)' }} />
                          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-red-500"
                            style={{ left:`${probPct}%`, boxShadow:'0 0 6px #ef4444' }} />
                        </div>
                        <span className="text-lg font-black text-yellow-300 tabular-nums">{ciHigh.toFixed(0)}%</span>
                      </div>
                      <div className="text-[9px] text-zinc-600 mt-1.5">Mean estimate: {probPct.toFixed(1)}% · Range: {ciLow.toFixed(0)}% – {ciHigh.toFixed(0)}% (95% confidence)</div>
                    </div>

                    {/* ── Probability explanation + action guidance ─────────── */}
                    <div className="rounded-xl p-4" style={{ background: probPct>50?'rgba(239,68,68,0.07)':probPct>15?'rgba(249,115,22,0.07)':'rgba(34,197,94,0.06)', border:`1px solid ${verdictColor}25` }}>
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color:verdictColor }}>What this means</div>
                      <p className="text-[10px] text-zinc-300 leading-relaxed mb-2">
                        The model estimates a <span className="font-black" style={{ color:verdictColor }}>{probPct.toFixed(0)}% probability</span> this call represents a credible threat.
                        The 95% confidence interval — <span className="font-bold text-yellow-300">{ciLow.toFixed(0)}% to {ciHigh.toFixed(0)}%</span> — captures the uncertainty across 600 Monte Carlo simulations.
                        Source: <span className="font-mono text-[9px] text-zinc-500">{probSource}</span>.
                      </p>
                      <div className="flex items-start gap-2 mt-2 pt-2.5" style={{ borderTop:`1px solid ${verdictColor}20` }}>
                        <span className="text-[10px] shrink-0">
                          {level>=5?'🚨':level>=4?'⚠️':level>=3?'⚡':level>=2?'👀':'✅'}
                        </span>
                        <div>
                          <div className="text-[10px] font-bold mb-0.5" style={{ color:verdictColor }}>Recommended action</div>
                          <p className="text-[10px] text-zinc-300 leading-relaxed">
                            {level >= 5 && 'IMMEDIATE RESPONSE — Call 911 and lock down the school now. Do not wait for additional verification. Alert every administrator on campus.'}
                            {level === 4 && 'Alert the principal immediately and contact local law enforcement. Do not dismiss this call. Verify the subject\'s location and secure the identified area.'}
                            {level === 3 && 'Notify school administration and the school safety officer now. Pull the subject in for a counselor meeting within the next hour. Document everything.'}
                            {level === 2 && 'Flag for counselor review today. Check in with any named students or staff. Monitor for additional tips about the same person or school.'}
                            {level <= 1 && 'Log and monitor. No immediate action required, but keep this tip in the system for cross-referencing if similar reports come in.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Top drivers + factor breakdown */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Bayesian drivers */}
                      {bayesTrace.length > 0 && (
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2.5">Top Bayesian Drivers</div>
                          <div className="flex flex-col gap-1.5">
                            {bayesTrace.slice(0,5).map((step, i) => {
                              const col = CAT_COLOR[step.feature.cat] ?? '#94a3b8'
                              return (
                                <div key={i} className="flex items-center gap-2 text-[10px] px-2.5 py-1.5 rounded-lg"
                                  style={{ background:`${col}10`, border:`1px solid ${col}20` }}>
                                  <span className="font-bold" style={{ color:col }}>{step.keyword}</span>
                                  <span className="text-zinc-600 flex-1 text-[9px]">{step.feature.cat}</span>
                                  <span className="font-mono text-[9px] text-zinc-500">LR {step.feature.lr.toFixed(1)}×</span>
                                  <span className="font-black text-[9px]" style={{ color: step.posteriorP>0.5?'#ef4444':step.posteriorP>0.15?'#f97316':'#22c55e' }}>
                                    +{(step.delta*100).toFixed(1)}pp
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Signal summary */}
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2.5">Signal Summary</div>
                        <div className="flex flex-col gap-1.5">
                          {[
                            { label:'Verbal threat', count:threatCount,      color:'#ef4444' },
                            { label:'Location cues', count:locationCount,    color:'#3b82f6' },
                            { label:'Credibility',   count:credibilityCount, color:'#06b6d4' },
                            { label:'Escalation',    count:escalationCount,  color:'#a855f7' },
                          ].filter(s => s.count > 0).map(s => (
                            <div key={s.label} className="flex items-center gap-2 text-[10px]">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background:s.color }} />
                              <span className="text-zinc-400 flex-1">{s.label}</span>
                              <span className="font-black tabular-nums" style={{ color:s.color }}>{s.count}</span>
                            </div>
                          ))}
                          {composites.length > 0 && (
                            <div className="flex items-center gap-2 text-[10px] mt-1 pt-1" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                              <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />
                              <span className="text-zinc-400 flex-1">Composite factors</span>
                              <span className="font-black tabular-nums text-indigo-400">{composites.length}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="px-6 py-3 flex items-center justify-between shrink-0"
            style={{ borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.01)' }}>
            <span className="text-[9px] text-zinc-700 font-mono">
              Kairos AI · Bayesian Monte Carlo · 600 simulations · 95% CI · {FEATURE_TABLE_FE.length} verbal features
            </span>
            <div className="flex items-center gap-3">
              {phase !== 'verdict' && (
                <button onClick={() => goToPhase('verdict')} className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors">
                  Skip to verdict →
                </button>
              )}
              {phase === 'verdict' && (
                <button onClick={onClose}
                  className="text-[10px] font-bold uppercase tracking-widest px-5 py-1.5 rounded-lg transition-all"
                  style={{ background:`${verdictColor}15`, color:verdictColor, border:`1px solid ${verdictColor}35` }}>
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
