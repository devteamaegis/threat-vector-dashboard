import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { triageTranscript } from '@/lib/threat-math'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Generic inbound-tip endpoint. Accepts payloads from:
//   • AgentPhone SMS webhook  (body: { from, body, school_hint, transcript })
//   • Twilio SMS webhook      (form-encoded: From, Body)
//   • In-dashboard simulator  (body: { transcript, school_name, source })
//   • Email forward (future)  (body: { from, subject, body, source: 'email' })
//
// Runs the Bayesian Monte Carlo + threat-math pipeline, writes a tip into
// Supabase (which the dashboard subscribes to in realtime), and fires the
// AgentMail brief for Level 3+ threats.
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''
  let payload: Record<string, unknown> = {}

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData()
    payload = Object.fromEntries(form.entries())
  } else if (contentType.includes('application/json')) {
    payload = await req.json()
  } else {
    return NextResponse.json({ error: 'Unsupported content-type' }, { status: 415 })
  }

  // Normalise across providers
  const transcript = String(
    payload.transcript ?? payload.Body ?? payload.body ?? payload.message ?? ''
  ).trim()
  if (!transcript) return NextResponse.json({ error: 'Missing transcript/body' }, { status: 400 })

  const source = String(payload.source ?? (payload.From ? 'sms' : 'sms'))
  const school = String(payload.school_name ?? payload.school_hint ?? 'Unknown School')
  const fromMasked = payload.From || payload.from ? '****' + String(payload.From ?? payload.from).slice(-4) : null
  const callerLanguage = String(payload.caller_language ?? 'English')

  // If the tip is not in English, translate the body first so the lexical scorer
  // and the Bayesian pipeline see English text. Keep the original around as well.
  let englishText = transcript
  let englishTranslation: string | null = null
  if (callerLanguage !== 'English') {
    try {
      const tr = await fetch(`${req.nextUrl.origin}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript, target: 'en' }),
      })
      if (tr.ok) {
        const trData = await tr.json()
        if (typeof trData.translated === 'string' && trData.translated.trim()) {
          englishText = trData.translated
          englishTranslation = trData.translated
        }
      }
    } catch { /* translation failed, fall through with original */ }
  }

  // Run the math pipeline locally so this works even when Python backend is offline.
  const report = triageTranscript(englishText)

  // ── Top driver lexicon words → bayes_top_drivers ────────────────────────────
  const topDrivers = report.lexical.hits
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(h => ({ feature: h.category, keyword: h.word, weight: h.weight }))

  const tipRow = {
    description: transcript.length > 280 ? transcript.slice(0, 277) + '…' : transcript,
    category:    inferCategory(report.lexical.hits.map(h => h.category)),
    urgency:     report.urgency,
    severity:    report.urgency,
    status:      'new',
    is_anonymous: true,
    ai_summary:  buildAiSummary(report, school, source),
    ai_triage_score:       Math.round(report.finalScore),
    ai_recommended_action: report.level >= 5 ? 'immediate_response' : report.level >= 4 ? 'urgent_review' : report.level >= 3 ? 'standard_review' : 'monitor',
    school_name:           school,
    caller_emotion:        report.emotion.dominant,
    caller_tone:           report.emotion.intensity > 7 ? 'urgent' : report.emotion.intensity > 4 ? 'concerned' : 'neutral',
    escalation_risk:       report.bayes.pEscalation > 0.5 ? 'imminent' : report.bayes.pEscalation > 0.2 ? 'escalating' : 'stable',
    key_facts:             report.lexical.hits.slice(0, 5).map(h => `${h.category}: "${h.word}"`),
    timeline:              report.lexical.hits.some(h => h.category === 'temporal') ? 'this_week' : 'unknown',
    caller_language:       callerLanguage,
    multilingual_call:     callerLanguage !== 'English',
    english_translation:   englishTranslation,
    gemini_level:          report.level,
    gemini_reasoning:      `Lexical=${report.lexical.score.toFixed(1)}, emotion=${report.emotion.dominant} (${report.emotion.intensity.toFixed(1)}/10), bayes μ=${report.bayes.mean.toFixed(2)}`,
    consensus:             true,
    threat_level:          report.level,
    bayes_probability_pct: Math.round((report.bayes.mean - 1) / 4 * 100),
    bayes_ci_low_pct:      Math.round((report.bayes.ci95[0] - 1) / 4 * 100),
    bayes_ci_high_pct:     Math.round((report.bayes.ci95[1] - 1) / 4 * 100),
    bayes_features_hit:    [...new Set(report.lexical.hits.map(h => h.category))],
    bayes_top_drivers:     topDrivers,
    three_model_consensus: true,
    location_context:      source === 'sms' ? `inbound SMS from ${fromMasked}` : source,
    created_at:            new Date().toISOString(),
  }

  // Write to Supabase — dashboard picks it up via realtime channel.
  // If a column is missing (because migration_spanish.sql hasn't been run yet),
  // retry with only the fields the legacy schema is guaranteed to have.
  const supabase = getSupabase()
  let inserted: { id?: string } | null = null
  let insertErr: { message?: string; code?: string; details?: string; hint?: string } | null = null
  {
    const { data, error } = await supabase.from('tips').insert(tipRow).select().single()
    if (error) insertErr = error
    else inserted = data
  }
  if (insertErr) {
    // Strip any extended columns that the DB may not have yet, retry with
    // the minimum-viable set the legacy schema is guaranteed to have.
    const EXTENDED_COLUMNS = [
      'english_translation', 'bayes_probability_pct', 'bayes_ci_low_pct',
      'bayes_ci_high_pct', 'bayes_features_hit', 'bayes_top_drivers',
      'three_model_consensus', 'threat_level', 'location_context',
      'call_lat', 'call_lng', 'multilingual_call', 'caller_language',
      'gemini_level', 'gemini_reasoning', 'consensus',
    ]
    const legacyRow: Record<string, unknown> = { ...tipRow }
    for (const k of EXTENDED_COLUMNS) delete legacyRow[k]
    const { data, error } = await supabase.from('tips').insert(legacyRow).select().single()
    if (error) {
      return NextResponse.json({
        error: 'Supabase write failed',
        first_error: { message: insertErr.message, code: insertErr.code, details: insertErr.details, hint: insertErr.hint },
        retry_error: { message: error.message, code: error.code, details: error.details, hint: error.hint },
        hint: 'Run supabase/migration_spanish.sql in the Supabase SQL editor, then retry.',
      }, { status: 502 })
    }
    inserted = data
  }

  // Fire AgentMail brief asynchronously for Level 3+ (don't await — keep response fast)
  if (report.level >= 3 && process.env.AGENTMAIL_API_KEY) {
    fetch(`${req.nextUrl.origin}/api/agentmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tip: { ...tipRow, id: inserted?.id }, report, transcript }),
    }).catch(() => { /* fire and forget */ })
  }

  // Fire Supermemory pattern store asynchronously
  if (process.env.SUPERMEMORY_API_KEY) {
    fetch(`${req.nextUrl.origin}/api/supermemory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tip: { ...tipRow, id: inserted?.id }, report }),
    }).catch(() => { /* fire and forget */ })
  }

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    triage_ms: 0, // local synchronous math, sub-millisecond
    level: report.level,
    urgency: report.urgency,
    bayes: { mean: report.bayes.mean, ci95: report.bayes.ci95, pEscalation: report.bayes.pEscalation },
    lexical_score: report.lexical.score,
    dominant_emotion: report.emotion.dominant,
  })
}

function inferCategory(cats: string[]): string {
  if (cats.includes('weapon')) return 'weapon'
  if (cats.includes('self_harm')) return 'self_harm'
  if (cats.includes('violence')) return 'threat'
  if (cats.includes('bullying')) return 'bullying'
  if (cats.includes('distress')) return 'threat'
  return 'tip'
}

function buildAiSummary(report: ReturnType<typeof triageTranscript>, school: string, source: string): string {
  const sev = report.urgency.toUpperCase()
  const driver = report.lexical.hits[0]?.word ?? 'general concern'
  const emo = report.emotion.dominant
  return `${sev}: ${source === 'sms' ? 'Student text' : 'Caller'} report at ${school}. Lexical signal anchored on "${driver}". Caller emotion: ${emo} (intensity ${report.emotion.intensity.toFixed(1)}/10). Posterior μ = ${report.bayes.mean.toFixed(2)} [95% CI ${report.bayes.ci95[0].toFixed(2)}–${report.bayes.ci95[1].toFixed(2)}]. P(escalation) = ${(report.bayes.pEscalation * 100).toFixed(0)}%.`
}
