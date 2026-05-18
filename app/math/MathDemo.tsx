'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  THREAT_LEXICON, scoreLexical, analyseEmotion, bayesPosterior,
  EMOTION_AXES, type EmotionAxis, type LexicalHit, type BayesResult,
} from '@/lib/threat-math'

// ── Showcase transcripts the user can step through during the demo ───────────
const SCENARIOS: { id: string; label: string; transcript: string; modelObs: Array<{ name: string; level: number; confidence: number }> }[] = [
  {
    id: 'weapon',
    label: 'Anonymous weapon tip',
    transcript: "Hi I need to report something anonymously . There is a student at Westbrook Academy who has been telling kids he is going to do something serious next week . He showed a photo of what looked like a weapon on his phone to multiple people in my class . We are all scared . This has been building for the past few weeks and the teachers don't know .",
    modelObs: [
      { name: 'Claude', level: 5, confidence: 0.86 },
      { name: 'Gemini', level: 4, confidence: 0.78 },
    ],
  },
  {
    id: 'fight',
    label: 'Cafeteria fight (student SMS)',
    transcript: "There is a fight starting in the cafeteria right now. Multiple kids. One of them has a knife. Please hurry, we are scared.",
    modelObs: [
      { name: 'Claude', level: 4, confidence: 0.80 },
      { name: 'Gemini', level: 4, confidence: 0.74 },
    ],
  },
  {
    id: 'suspicious',
    label: 'Suspicious person on campus',
    transcript: "There is a man in a black hoodie walking around the back entrance. He doesn't look like a parent. He has been standing near the playground for twenty minutes.",
    modelObs: [
      { name: 'Claude', level: 3, confidence: 0.62 },
      { name: 'Gemini', level: 2, confidence: 0.58 },
    ],
  },
  {
    id: 'bullying',
    label: 'Bullying report',
    transcript: "A group of boys keeps harassing my friend after school. They follow her home. She is afraid to come to school. The bullying has been going on for weeks.",
    modelObs: [
      { name: 'Claude', level: 3, confidence: 0.71 },
      { name: 'Gemini', level: 3, confidence: 0.68 },
    ],
  },
]

// ── Small helpers ─────────────────────────────────────────────────────────────
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }

function highlightTranscript(text: string, hits: LexicalHit[]): React.ReactNode[] {
  if (hits.length === 0) return [text]
  const out: React.ReactNode[] = []
  const lower = text.toLowerCase()
  let cursor = 0
  // Find every match position for every hit word
  const matches: { start: number; end: number; weight: number; category: string; word: string }[] = []
  for (const h of hits) {
    const re = new RegExp(`\\b${h.word}\\b`, 'gi')
    for (const m of lower.matchAll(re)) {
      matches.push({ start: m.index!, end: (m.index! + m[0].length), weight: h.weight, category: h.category, word: m[0] })
    }
  }
  matches.sort((a, b) => a.start - b.start)
  let key = 0
  for (const m of matches) {
    if (m.start < cursor) continue
    out.push(text.slice(cursor, m.start))
    out.push(
      <mark key={key++}
        className="px-1 rounded animate-popin"
        style={{
          background: categoryColor(m.category, 0.22),
          color: 'inherit',
          border: `1px solid ${categoryColor(m.category, 0.55)}`,
          fontWeight: 700,
          boxShadow: `0 0 12px ${categoryColor(m.category, 0.35)}`,
        }}>
        {text.slice(m.start, m.end)}
        <sup className="text-[8px] opacity-80 ml-0.5">+{m.weight.toFixed(1)}</sup>
      </mark>
    )
    cursor = m.end
  }
  out.push(text.slice(cursor))
  return out
}

function categoryColor(cat: string, alpha = 1): string {
  const m: Record<string, string> = {
    weapon:    `rgba(239, 68, 68, ${alpha})`,
    violence:  `rgba(249, 115, 22, ${alpha})`,
    temporal:  `rgba(168, 85, 247, ${alpha})`,
    evidence:  `rgba(16, 185, 129, ${alpha})`,
    distress:  `rgba(245, 158, 11, ${alpha})`,
    self_harm: `rgba(220, 38, 127, ${alpha})`,
    bullying:  `rgba(99, 102, 241, ${alpha})`,
  }
  return m[cat] ?? `rgba(148, 163, 184, ${alpha})`
}

// ── Animated formula renderer ─────────────────────────────────────────────────
// Each token of the formula appears with a stagger so screenshare audiences
// can read it term-by-term.
function Formula({ tokens, play, delay = 0 }: { tokens: { t: string; em?: boolean; sub?: string; sup?: string; muted?: boolean }[]; play: boolean; delay?: number }) {
  return (
    <div className="flex flex-wrap items-end gap-x-1.5 gap-y-2 text-[18px] font-mono">
      {tokens.map((tok, i) => (
        <span key={i}
          className={`inline-flex items-baseline ${play ? 'animate-popin' : 'opacity-0'} ${tok.em ? 'font-bold text-cyan-300' : ''} ${tok.muted ? 'text-zinc-500' : ''}`}
          style={{ animationDelay: `${delay + i * 110}ms`, animationFillMode: 'forwards' }}
        >
          <span>{tok.t}</span>
          {tok.sub && <sub className="text-[10px] ml-0.5 text-zinc-400">{tok.sub}</sub>}
          {tok.sup && <sup className="text-[10px] ml-0.5 text-zinc-400">{tok.sup}</sup>}
        </span>
      ))}
    </div>
  )
}

// ── Histogram for Monte Carlo samples ─────────────────────────────────────────
function Histogram({ samples, mean, ci }: { samples: number[]; mean: number; ci: [number, number] }) {
  const bins = 30
  const lo = 1, hi = 5
  const width = (hi - lo) / bins
  const counts = new Array(bins).fill(0)
  for (const s of samples) {
    const idx = clamp(Math.floor((s - lo) / width), 0, bins - 1)
    counts[idx]++
  }
  const max = Math.max(...counts, 1)
  return (
    <div className="relative h-32 w-full flex items-end gap-[1px] px-1">
      {counts.map((c, i) => {
        const h = (c / max) * 100
        const center = lo + (i + 0.5) * width
        const inCI = center >= ci[0] && center <= ci[1]
        const isMean = Math.abs(center - mean) < width
        return (
          <div key={i}
            className="flex-1 rounded-t-sm transition-all duration-700"
            style={{
              height: `${h}%`,
              background: isMean ? '#ef4444' : inCI ? 'rgba(6, 182, 212, 0.75)' : 'rgba(99, 102, 241, 0.45)',
              boxShadow: isMean ? '0 0 18px rgba(239, 68, 68, 0.8)' : undefined,
            }}
          />
        )
      })}
      {/* Mean marker line */}
      <div className="absolute inset-y-0 pointer-events-none"
        style={{ left: `${((mean - lo) / (hi - lo)) * 100}%`, width: 2, background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
      {/* CI bracket */}
      <div className="absolute -bottom-3 h-3 pointer-events-none flex items-center"
        style={{
          left: `${((ci[0] - lo) / (hi - lo)) * 100}%`,
          width: `${((ci[1] - ci[0]) / (hi - lo)) * 100}%`,
          borderLeft: '2px solid #06b6d4',
          borderRight: '2px solid #06b6d4',
          borderTop: '2px solid #06b6d4',
        }}
      />
    </div>
  )
}

// ── Main demo component ───────────────────────────────────────────────────────
export default function MathDemo() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const scenario = SCENARIOS.find(s => s.id === scenarioId)!
  const [play, setPlay] = useState(true)
  const [section, setSection] = useState<'lex' | 'emo' | 'bayes' | 'final'>('lex')

  // Recompute on scenario change
  const lex = useMemo(() => scoreLexical(scenario.transcript), [scenario.transcript])
  const emo = useMemo(() => analyseEmotion(scenario.transcript), [scenario.transcript])
  const lexBoost = useMemo(() => lex.hits.filter(h => h.category === 'weapon' || h.category === 'temporal').reduce((s, h) => s + h.weight * 0.05, 0), [lex])
  const bayes: BayesResult = useMemo(
    () => bayesPosterior(scenario.modelObs, { iterations: 1000, seed: 42, lexicalBoost: lexBoost }),
    [scenario.modelObs, lexBoost]
  )

  // Replay animations whenever scenario or section changes
  useEffect(() => {
    setPlay(false)
    const id = setTimeout(() => setPlay(true), 40)
    return () => clearTimeout(id)
  }, [scenario.id, section])

  // Auto-advance through sections like a slide deck
  function advance() {
    setSection(s => s === 'lex' ? 'emo' : s === 'emo' ? 'bayes' : s === 'bayes' ? 'final' : 'lex')
  }

  return (
    <div className="min-h-screen text-zinc-200" style={{ background: 'radial-gradient(ellipse at top, #0c1224 0%, #050608 60%)' }}>
      <style jsx global>{`
        @keyframes popin {
          0%   { opacity: 0; transform: translateY(8px) scale(0.92); filter: blur(4px); }
          60%  { opacity: 1; transform: translateY(-2px) scale(1.03); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0)  scale(1); }
        }
        .animate-popin {
          animation: popin 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
        }
        @keyframes drift {
          0%   { transform: translateX(0) translateY(0); opacity: 0.6; }
          50%  { transform: translateX(40px) translateY(-30px); opacity: 1; }
          100% { transform: translateX(80px) translateY(0); opacity: 0.4; }
        }
        @keyframes spark {
          0%, 100% { box-shadow: 0 0 0   rgba(6, 182, 212, 0.0); }
          50%      { box-shadow: 0 0 24px rgba(6, 182, 212, 0.55); }
        }
        .spark { animation: spark 2.2s ease-in-out infinite; }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-1">Kairos · Threat Math</div>
            <h1 className="text-3xl font-black">The Math Behind the Triage</h1>
            <p className="text-zinc-400 mt-2 text-sm max-w-2xl">
              Every tip flows through three mathematical layers — lexical scoring, emotion vector analysis, and a Bayesian Monte Carlo posterior. This page animates each layer in real time using the selected transcript.
            </p>
          </div>
          <div className="flex gap-2">
            {SCENARIOS.map(s => (
              <button key={s.id}
                onClick={() => setScenarioId(s.id)}
                className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${scenarioId === s.id ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transcript card */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 mb-6 spark">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">Live transcript</span>
          </div>
          <p className="text-[16px] leading-relaxed">
            {highlightTranscript(scenario.transcript, lex.hits)}
          </p>
          <div className="mt-3 flex gap-3 flex-wrap text-[10px]">
            <span className="text-zinc-500">Highlighted tokens carry log-likelihood-ratio weights. Hover-color = category.</span>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 mb-6 border-b border-zinc-800">
          {(['lex', 'emo', 'bayes', 'final'] as const).map(s => (
            <button key={s}
              onClick={() => setSection(s)}
              className={`px-5 py-3 text-[11px] uppercase tracking-[0.2em] font-bold border-b-2 transition-all ${section === s ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
              {s === 'lex' ? '1. Threat-word TF-IDF' : s === 'emo' ? '2. Emotion vector cosine' : s === 'bayes' ? '3. Bayesian Monte Carlo' : '4. Final score'}
            </button>
          ))}
          <button onClick={advance} className="ml-auto text-[10px] px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20">
            Next ▸
          </button>
        </div>

        {/* ── Section: Lexical ────────────────────────────────────────────── */}
        {section === 'lex' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 mb-4 font-bold">1 · Threat-Word TF-IDF Score</div>
              <p className="text-[12px] text-zinc-400 mb-4 leading-relaxed">
                Each lexicon word has a pre-computed log-likelihood-ratio (LLR) weight: <span className="text-zinc-200 font-mono">log P(word | threat) / P(word | benign)</span>. We sum a TF-augmented score over every match in the transcript, then squash to <span className="font-mono text-cyan-300">[0, 10]</span>.
              </p>
              <Formula play={play} tokens={[
                { t: 's', sub: 'lex' },
                { t: '=' },
                { t: '10' },
                { t: '·' },
                { t: '(' },
                { t: '1' },
                { t: '−' },
                { t: 'exp' },
                { t: '(' },
                { t: '−' },
                { t: '∑', em: true },
                { t: '(1 + log·tf', sub: 'i' },
                { t: ')' },
                { t: '·' },
                { t: 'w', sub: 'i', em: true },
                { t: '/ 6' },
                { t: ')' },
                { t: ')' },
              ]} />
              <div className="mt-6 p-4 rounded-xl bg-black/40 border border-zinc-800">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Worked example for this transcript</div>
                <div className="space-y-1 text-[12px] font-mono">
                  {lex.hits.map((h, i) => (
                    <div key={i} className={`flex justify-between ${play ? 'animate-popin' : 'opacity-0'}`}
                      style={{ animationDelay: `${600 + i * 120}ms`, animationFillMode: 'forwards' }}>
                      <span><span className="px-1.5 py-0.5 rounded mr-2" style={{ background: categoryColor(h.category, 0.25), color: categoryColor(h.category, 1) }}>{h.category}</span><span className="text-zinc-300">{h.word}</span></span>
                      <span className="text-cyan-300">+{h.weight.toFixed(2)}</span>
                    </div>
                  ))}
                  {lex.hits.length === 0 && <div className="text-zinc-500">No lexicon hits.</div>}
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-baseline">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">s_lex</span>
                  <span className="text-2xl font-black text-cyan-300 tabular-nums">{lex.score.toFixed(2)} / 10</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4 font-bold">Lexicon (live)</div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono max-h-[400px] overflow-y-auto pr-2">
                {THREAT_LEXICON.map((e, i) => {
                  const hit = lex.hits.find(h => h.word === e.word)
                  return (
                    <div key={i} className={`flex justify-between px-2 py-1 rounded border ${hit ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-zinc-800'}`}>
                      <span>
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: categoryColor(e.category, 1) }} />
                        {e.word}
                      </span>
                      <span className={hit ? 'text-cyan-300' : 'text-zinc-500'}>{e.weight.toFixed(1)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Section: Emotion vector ─────────────────────────────────────── */}
        {section === 'emo' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 mb-4 font-bold">2 · Emotion Vector — Cosine Similarity</div>
              <p className="text-[12px] text-zinc-400 mb-4 leading-relaxed">
                We project the transcript into a 5-dim emotion space, then compute cosine similarity to each reference emotion's centroid. The largest similarity is the dominant emotion; the vector's L2 norm becomes the <span className="font-mono text-cyan-300">intensity</span>.
              </p>
              <Formula play={play} tokens={[
                { t: 'cos' },
                { t: '(' },
                { t: 'v', em: true },
                { t: ',' },
                { t: 'c', sub: 'k', em: true },
                { t: ')' },
                { t: '=' },
                { t: '⟨v, c', sub: 'k' },
                { t: '⟩' },
                { t: '/' },
                { t: '(' },
                { t: '‖v‖' },
                { t: '·' },
                { t: '‖c', sub: 'k' },
                { t: '‖' },
                { t: ')' },
              ]} />
              <Formula play={play} delay={500} tokens={[
                { t: 'intensity' },
                { t: '=' },
                { t: '10' },
                { t: '·' },
                { t: '(' },
                { t: '1' },
                { t: '−' },
                { t: 'exp' },
                { t: '(' },
                { t: '−' },
                { t: '‖v‖' },
                { t: '/ 3' },
                { t: ')' },
                { t: ')' },
              ]} />
              <div className="mt-6 p-4 rounded-xl bg-black/40 border border-zinc-800">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Vector projection</div>
                <div className="text-[11px] font-mono text-zinc-300 mb-4">
                  v = [ {emo.vector.map(x => x.toFixed(2)).join(', ')} ]
                </div>
                <div className="space-y-2">
                  {EMOTION_AXES.map((axis, i) => {
                    const sim = emo.similarities[axis as EmotionAxis]
                    const pct = sim * 100
                    const isDom = axis === emo.dominant
                    return (
                      <div key={axis} className={play ? 'animate-popin' : 'opacity-0'}
                        style={{ animationDelay: `${800 + i * 120}ms`, animationFillMode: 'forwards' }}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className={`font-mono ${isDom ? 'text-red-400 font-bold' : 'text-zinc-400'}`}>{axis}{isDom && '   ← dominant'}</span>
                          <span className="font-mono text-cyan-300">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full transition-all duration-1000"
                            style={{
                              width: `${Math.max(0, pct)}%`,
                              background: isDom ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'rgba(99, 102, 241, 0.7)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-baseline">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">intensity</span>
                  <span className="text-2xl font-black text-cyan-300 tabular-nums">{emo.intensity.toFixed(2)} / 10</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4 font-bold">Why cosine, not Euclidean?</div>
              <ul className="space-y-3 text-[12px] text-zinc-400 leading-relaxed">
                <li className="flex gap-3">
                  <span className="text-cyan-400 mt-0.5">▸</span>
                  <span><b className="text-zinc-200">Length-invariant.</b> A long, panicked monologue and a short panicked plea point in the same direction in emotion-space — cosine ignores magnitude.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan-400 mt-0.5">▸</span>
                  <span><b className="text-zinc-200">Direction = emotion shape.</b> The ratio between fear-words and calm-words is what defines the emotion, not the absolute count.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-cyan-400 mt-0.5">▸</span>
                  <span><b className="text-zinc-200">Magnitude becomes intensity.</b> We separately compute L2-norm and squash with <span className="font-mono text-cyan-300">1 − exp(−‖v‖/3)</span> for a 0..10 score.</span>
                </li>
              </ul>
              <div className="mt-6 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-[11px] text-cyan-200">
                <b className="block mb-1">Dominant: <span className="text-red-400">{emo.dominant}</span></b>
                Confidence: cosine = {(emo.similarities[emo.dominant] * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* ── Section: Bayesian Monte Carlo ───────────────────────────────── */}
        {section === 'bayes' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 mb-4 font-bold">3 · Bayesian Monte Carlo Posterior</div>
              <p className="text-[12px] text-zinc-400 mb-4 leading-relaxed">
                Each model (Claude, Gemini, lexical, emotion) emits a level <span className="font-mono">L<sub>i</sub></span> with confidence <span className="font-mono">c<sub>i</sub></span>. We treat each as a Gaussian observation of the true threat level <span className="font-mono">θ</span>. A precision-weighted update gives the posterior <span className="font-mono">N(μ<sub>post</sub>, σ²<sub>post</sub>)</span>; 1000 Monte Carlo samples give the histogram below.
              </p>
              <Formula play={play} tokens={[
                { t: 'P' },
                { t: '(' },
                { t: 'θ', em: true },
                { t: ' | ' },
                { t: 'D' },
                { t: ')' },
                { t: '∝' },
                { t: 'P(θ)' },
                { t: '·' },
                { t: '∏', em: true },
                { t: 'P(L', sub: 'i' },
                { t: ' | θ, c', sub: 'i' },
                { t: ')' },
              ]} />
              <Formula play={play} delay={500} tokens={[
                { t: 'τ', sub: 'post', em: true },
                { t: '=' },
                { t: 'τ', sub: '0' },
                { t: '+' },
                { t: '∑', em: true },
                { t: 'c', sub: 'i' },
                { t: '/ σ²', sub: 'model' },
              ]} />
              <Formula play={play} delay={1000} tokens={[
                { t: 'μ', sub: 'post', em: true },
                { t: '=' },
                { t: '(' },
                { t: 'μ', sub: '0' },
                { t: '·' },
                { t: 'τ', sub: '0' },
                { t: '+' },
                { t: '∑', em: true },
                { t: 'L', sub: 'i' },
                { t: '·' },
                { t: 'c', sub: 'i' },
                { t: '/ σ²', sub: 'model' },
                { t: ')' },
                { t: '/ τ', sub: 'post' },
              ]} />
              <div className="mt-4 p-3 rounded-xl bg-black/40 border border-zinc-800 text-[11px] font-mono">
                <div className="text-zinc-500 mb-2">Observations for this transcript:</div>
                {scenario.modelObs.map((o, i) => (
                  <div key={i} className={`flex justify-between ${play ? 'animate-popin' : 'opacity-0'}`} style={{ animationDelay: `${1400 + i * 120}ms`, animationFillMode: 'forwards' }}>
                    <span className="text-zinc-300">{o.name}</span>
                    <span>L<sub>i</sub> = <span className="text-cyan-300">{o.level}</span>, c<sub>i</sub> = <span className="text-cyan-300">{o.confidence.toFixed(2)}</span></span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-zinc-800 text-zinc-500">
                  Prior: N(μ₀ = 2.5, σ₀ = 1.5) · σ_model = 0.6 · lex boost = +{lexBoost.toFixed(3)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6">
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4 font-bold">1,000 Monte Carlo samples</div>
              <Histogram samples={bayes.samples} mean={bayes.mean} ci={bayes.ci95} />
              <div className="mt-8 grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-red-300 mb-1">Posterior mean</div>
                  <div className="text-2xl font-black text-red-400 tabular-nums">{bayes.mean.toFixed(2)}</div>
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-cyan-300 mb-1">95% CI</div>
                  <div className="text-base font-bold text-cyan-300 tabular-nums">[{bayes.ci95[0].toFixed(2)}, {bayes.ci95[1].toFixed(2)}]</div>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-orange-300 mb-1">P(escalate ≥ 4)</div>
                  <div className="text-2xl font-black text-orange-400 tabular-nums">{(bayes.pEscalation * 100).toFixed(1)}%</div>
                </div>
              </div>
              <p className="mt-4 text-[11px] text-zinc-400 leading-relaxed">
                The red bar is the posterior mean — this becomes the final threat level (rounded). The cyan bracket is the 95% credible interval. If <span className="font-mono text-orange-300">P(θ ≥ 4)</span> exceeds 50%, we treat the tip as high-confidence and fire the Twilio SMS + AgentMail brief immediately.
              </p>
            </div>
          </div>
        )}

        {/* ── Section: Final score ────────────────────────────────────────── */}
        {section === 'final' && (
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8">
            <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 mb-4 font-bold">4 · Final Threat Score</div>
            <Formula play={play} tokens={[
              { t: 'S', sub: 'final', em: true },
              { t: '=' },
              { t: '1.8' },
              { t: '·' },
              { t: 'μ', sub: 'post' },
              { t: '+' },
              { t: '0.15' },
              { t: '·' },
              { t: 's', sub: 'lex' },
            ]} />
            <div className="mt-8 grid grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-black/40 border border-zinc-800">
                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Lexical s_lex</div>
                <div className="text-2xl font-black text-cyan-300 tabular-nums">{lex.score.toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-zinc-800">
                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Emotion intensity</div>
                <div className="text-2xl font-black text-cyan-300 tabular-nums">{emo.intensity.toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-zinc-800">
                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Posterior μ</div>
                <div className="text-2xl font-black text-cyan-300 tabular-nums">{bayes.mean.toFixed(2)}</div>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="text-[9px] uppercase tracking-[0.2em] text-red-300 mb-1">FINAL · 0–10</div>
                <div className="text-3xl font-black text-red-400 tabular-nums">
                  {clamp(bayes.mean * 1.8 + lex.score * 0.15, 0, 10).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="mt-8 p-5 rounded-xl bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border border-red-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl font-black bg-red-500/20 text-red-300">{clamp(Math.round(bayes.mean), 1, 5)}</div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-red-300 mb-0.5">Routed action</div>
                  <div className="text-lg font-bold">
                    {bayes.mean >= 4.5 ? 'IMMEDIATE — SRO + 911 + principal SMS + AgentMail brief'
                     : bayes.mean >= 3.5 ? 'URGENT — principal SMS, AgentMail brief, OSINT enrich'
                     : bayes.mean >= 2.5 ? 'WATCH — supermemory pattern store, principal email'
                     : 'LOG — Supabase only, no immediate alert'}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                The 95% credible interval {bayes.ci95[0].toFixed(2)}–{bayes.ci95[1].toFixed(2)} tells the principal how confident the model is.
                If the interval straddles a critical threshold (e.g. crosses level 4), the dashboard flags the tip for human review even when the mean is below threshold.
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 text-[10px] text-zinc-600 text-center">
          Math: TF-IDF (Salton 1971) · Cosine similarity (Singhal 2001) · Bayesian inference (Bayes 1763) · Monte Carlo (Metropolis & Ulam 1949).
        </div>
      </div>
    </div>
  )
}
