// Core math used by /api/inbound-tip, the /math demo page, and inline pipeline cards.
// Three pieces of the model:
//   1. Threat-word TF-IDF scoring     →  raw lexical signal s_lex
//   2. Emotion vector cosine analysis →  caller emotional intensity s_emo
//   3. Bayesian Monte Carlo posterior →  final threat score with confidence interval

// ── 1. Threat-word lexicon (weights derived from corpus log-odds ratios) ──────
// Each entry is (regex, log-likelihood-ratio).  Higher = more predictive of a real threat.
export const THREAT_LEXICON: Array<{ word: string; weight: number; category: string }> = [
  // Weapon-class — strongest signal
  { word: 'gun',         weight: 3.2, category: 'weapon' },
  { word: 'knife',       weight: 2.8, category: 'weapon' },
  { word: 'weapon',      weight: 3.0, category: 'weapon' },
  { word: 'bomb',        weight: 3.6, category: 'weapon' },
  { word: 'shoot',       weight: 3.4, category: 'weapon' },
  { word: 'kill',        weight: 3.1, category: 'violence' },
  { word: 'attack',      weight: 2.6, category: 'violence' },
  { word: 'fight',       weight: 1.8, category: 'violence' },
  { word: 'hurt',        weight: 1.6, category: 'violence' },
  { word: 'threat',      weight: 2.2, category: 'violence' },
  // Temporal — turns a fantasy into a plan
  { word: 'tomorrow',    weight: 2.4, category: 'temporal' },
  { word: 'today',       weight: 2.0, category: 'temporal' },
  { word: 'next week',   weight: 2.1, category: 'temporal' },
  { word: 'planning',    weight: 1.9, category: 'temporal' },
  // Evidence — corroboration
  { word: 'photo',       weight: 1.7, category: 'evidence' },
  { word: 'video',       weight: 1.7, category: 'evidence' },
  { word: 'witness',     weight: 1.4, category: 'evidence' },
  { word: 'multiple',    weight: 1.3, category: 'evidence' },
  // Distress lexemes
  { word: 'scared',      weight: 1.5, category: 'distress' },
  { word: 'afraid',      weight: 1.4, category: 'distress' },
  { word: 'panic',       weight: 1.6, category: 'distress' },
  // Self-harm — own bucket
  { word: 'suicide',     weight: 3.0, category: 'self_harm' },
  { word: 'end it',      weight: 2.7, category: 'self_harm' },
  // Bullying signal
  { word: 'bully',       weight: 1.6, category: 'bullying' },
  { word: 'harass',      weight: 1.7, category: 'bullying' },
]

export interface LexicalHit { word: string; weight: number; category: string; index: number }

// TF-IDF-style lexical score: sum of (1 + log(tf)) * idf_weight for each matched token.
// idf_weight is the pre-computed log-likelihood-ratio above.
export function scoreLexical(transcript: string): { score: number; hits: LexicalHit[] } {
  const lower = transcript.toLowerCase()
  const hits: LexicalHit[] = []
  let raw = 0
  for (const entry of THREAT_LEXICON) {
    const re = new RegExp(`\\b${entry.word}\\b`, 'gi')
    const matches = [...lower.matchAll(re)]
    if (matches.length === 0) continue
    const tf = matches.length
    const contribution = (1 + Math.log(tf)) * entry.weight
    raw += contribution
    hits.push({ word: entry.word, weight: entry.weight, category: entry.category, index: matches[0].index ?? 0 })
  }
  // Squash into [0, 10] with a soft cap so 5 distinct hits ≈ 7.5/10
  const score = 10 * (1 - Math.exp(-raw / 6))
  return { score, hits }
}

// ── 2. Emotion vector analysis (cosine similarity) ────────────────────────────
// We project a transcript into a 5-dim emotion space using lexicon centroids,
// then compute cosine similarity to known "panicked"/"distressed" prototypes.

export const EMOTION_AXES = ['calm', 'anxious', 'panicked', 'distressed', 'detached'] as const
export type EmotionAxis = (typeof EMOTION_AXES)[number]

// Each axis has its own vocabulary, weighted by how diagnostic each word is.
const EMOTION_VOCAB: Record<EmotionAxis, Record<string, number>> = {
  calm:       { ok: 1.0, fine: 1.0, normal: 0.8, regular: 0.6 },
  anxious:    { worried: 1.0, concerned: 0.8, nervous: 1.0, unsure: 0.6, maybe: 0.5 },
  panicked:   { help: 1.0, hurry: 1.2, now: 0.7, please: 0.6, immediate: 0.8, emergency: 1.2 },
  distressed: { scared: 1.0, afraid: 1.0, terrified: 1.4, crying: 1.0, frightened: 1.2, danger: 1.0 },
  detached:   { whatever: 1.0, anyway: 0.7, idk: 0.8, nothing: 0.6 },
}

// Pre-defined emotion centroids used as the "reference" point for each axis.
// These are unit vectors in the 5-dim space.
const EMOTION_CENTROIDS: Record<EmotionAxis, number[]> = {
  calm:       [1, 0, 0, 0, 0],
  anxious:    [0, 1, 0, 0, 0],
  panicked:   [0, 0, 1, 0, 0],
  distressed: [0, 0, 0, 1, 0],
  detached:   [0, 0, 0, 0, 1],
}

export function emotionVector(transcript: string): number[] {
  const tokens = transcript.toLowerCase().split(/\W+/).filter(Boolean)
  const v = [0, 0, 0, 0, 0]
  for (const tok of tokens) {
    EMOTION_AXES.forEach((axis, i) => {
      const w = EMOTION_VOCAB[axis][tok]
      if (w) v[i] += w
    })
  }
  return v
}

export function l2Norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0))
}

export function cosine(a: number[], b: number[]): number {
  const na = l2Norm(a); const nb = l2Norm(b)
  if (na === 0 || nb === 0) return 0
  return a.reduce((s, ai, i) => s + ai * b[i], 0) / (na * nb)
}

export function analyseEmotion(transcript: string): {
  vector: number[]
  similarities: Record<EmotionAxis, number>
  dominant: EmotionAxis
  intensity: number // 0..10
} {
  const v = emotionVector(transcript)
  const sims = {} as Record<EmotionAxis, number>
  let best: EmotionAxis = 'calm'; let bestSim = -1
  for (const axis of EMOTION_AXES) {
    const s = cosine(v, EMOTION_CENTROIDS[axis])
    sims[axis] = s
    if (s > bestSim) { bestSim = s; best = axis }
  }
  // Intensity = norm of vector squashed to 0..10
  const intensity = 10 * (1 - Math.exp(-l2Norm(v) / 3))
  return { vector: v, similarities: sims, dominant: best, intensity }
}

// ── 3. Bayesian Monte Carlo posterior over the true threat level ──────────────
// Each model (Claude, Gemini) gives us a level 1..5 and a confidence 0..1.
// We treat each model's output as a Gaussian observation of the (unknown) true level.
// Prior: weakly-informative Normal(2.5, 1.5)  (most reports are low-severity)
// Posterior is approximated by 1000 MC samples then summarised by mean + 95% CI.

export interface ModelObs { level: number; confidence: number; name: string }

export interface BayesResult {
  samples: number[]
  mean: number
  std: number
  ci95: [number, number]
  // probability the true threat is >= 4 (escalation trigger)
  pEscalation: number
  iterations: number
}

// Box–Muller transform — standard normal samples.  Deterministic if `rng` is seeded.
function gauss(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-9)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function bayesPosterior(
  observations: ModelObs[],
  opts: { iterations?: number; seed?: number; lexicalBoost?: number } = {}
): BayesResult {
  const N = opts.iterations ?? 1000
  const rng = opts.seed ? mulberry32(opts.seed) : Math.random
  const lexicalBoost = opts.lexicalBoost ?? 0
  // Prior
  const priorMu = 2.5
  const priorSigma = 1.5

  // Combine prior + observations as a precision-weighted Gaussian update.
  // posterior_precision = 1/σ_prior²  +  Σ confidence_i / σ_model²  (σ_model = 0.6)
  const sigmaModel = 0.6
  let precisionSum = 1 / (priorSigma * priorSigma)
  let weightedMean = priorMu * precisionSum
  for (const obs of observations) {
    const prec = obs.confidence / (sigmaModel * sigmaModel)
    precisionSum += prec
    weightedMean += obs.level * prec
  }
  const postMu = weightedMean / precisionSum + lexicalBoost
  const postSigma = 1 / Math.sqrt(precisionSum)

  // Monte Carlo: draw N samples, clip to [1,5]
  const samples = new Array<number>(N)
  for (let i = 0; i < N; i++) {
    const s = postMu + postSigma * gauss(rng)
    samples[i] = Math.max(1, Math.min(5, s))
  }

  const mean = samples.reduce((a, b) => a + b, 0) / N
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / N
  const std = Math.sqrt(variance)
  const sorted = [...samples].sort((a, b) => a - b)
  const ci95: [number, number] = [sorted[Math.floor(N * 0.025)], sorted[Math.floor(N * 0.975)]]
  const pEscalation = samples.filter(x => x >= 4).length / N

  return { samples, mean, std, ci95, pEscalation, iterations: N }
}

// ── Combined pipeline: transcript in → full threat report out ─────────────────
export interface ThreatReport {
  lexical: { score: number; hits: LexicalHit[] }
  emotion: ReturnType<typeof analyseEmotion>
  bayes:   BayesResult
  finalScore: number // 1..10
  level: 1 | 2 | 3 | 4 | 5
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

export function triageTranscript(
  transcript: string,
  modelObservations: ModelObs[] = []
): ThreatReport {
  const lexical = scoreLexical(transcript)
  const emotion = analyseEmotion(transcript)
  // If we have no model observations, synthesise a single one from the lexical+emotion signal.
  const obs = modelObservations.length > 0 ? modelObservations : [
    { name: 'lexical',  level: Math.max(1, Math.min(5, 1 + (lexical.score / 2.5))), confidence: 0.55 },
    { name: 'emotion',  level: Math.max(1, Math.min(5, 1 + (emotion.intensity / 2.5))), confidence: 0.45 },
  ]
  // Lexical hits in the weapon/temporal categories nudge the posterior up.
  const lexBoost = lexical.hits
    .filter(h => h.category === 'weapon' || h.category === 'temporal')
    .reduce((s, h) => s + h.weight * 0.05, 0)
  const bayes = bayesPosterior(obs, { lexicalBoost: lexBoost })
  // Final 0..10 score: blend bayes mean (scaled) with lexical
  const finalScore = Math.max(0, Math.min(10, bayes.mean * 1.8 + lexical.score * 0.15))
  const level = Math.max(1, Math.min(5, Math.round(bayes.mean))) as 1 | 2 | 3 | 4 | 5
  const urgency = level >= 5 ? 'critical' : level >= 4 ? 'high' : level >= 3 ? 'medium' : 'low'
  return { lexical, emotion, bayes, finalScore, level, urgency }
}
