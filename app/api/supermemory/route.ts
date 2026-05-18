import { NextRequest, NextResponse } from 'next/server'

const SUPERMEMORY_BASE = 'https://api.supermemory.ai/v3'

// POST: store a per-school pattern memory.   Body: { tip, report }
// GET ?school=<name>: recall pattern memories scoped to a school.
//
// We store one memory per threat tip so the AI can recall things like
// "Westbrook Academy has had 3 weapon tips this semester" across sessions.

export async function POST(req: NextRequest) {
  const apiKey = process.env.SUPERMEMORY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'SUPERMEMORY_API_KEY not set' }, { status: 500 })

  const body = await req.json()
  const tip = body.tip ?? {}
  const report = body.report ?? {}

  const content = [
    `THREAT at ${tip.school_name ?? 'Unknown'} — Level ${tip.threat_level ?? '?'}/5`,
    `Category: ${tip.category ?? 'unknown'}`,
    `Caller emotion: ${tip.caller_emotion ?? 'unknown'}`,
    `Summary: ${tip.ai_summary ?? ''}`,
    `Bayes μ = ${report?.bayes?.mean?.toFixed(2) ?? '?'}, P(escalation) = ${((report?.bayes?.pEscalation ?? 0) * 100).toFixed(0)}%`,
    `Key facts: ${Array.isArray(tip.key_facts) ? tip.key_facts.join('; ') : ''}`,
  ].join('\n')

  const metadata: Record<string, string | number> = {
    school: String(tip.school_name ?? 'unknown'),
    category: String(tip.category ?? 'tip'),
    urgency: String(tip.urgency ?? 'unknown'),
    threat_level: Number(tip.threat_level ?? 0),
    tip_id: String(tip.id ?? ''),
  }

  try {
    const r = await fetch(`${SUPERMEMORY_BASE}/memories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        metadata,
        container_tags: [`school:${tip.school_name ?? 'unknown'}`, `category:${tip.category ?? 'tip'}`, 'kairos:threat'],
      }),
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      return NextResponse.json({ error: 'Supermemory write failed', status: r.status, detail: errText }, { status: 502 })
    }
    const data = await r.json().catch(() => ({}))
    return NextResponse.json({ ok: true, supermemory: data })
  } catch (err) {
    return NextResponse.json({ error: 'Supermemory request failed', detail: String(err) }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.SUPERMEMORY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'SUPERMEMORY_API_KEY not set' }, { status: 500 })

  const school = req.nextUrl.searchParams.get('school')
  const q = req.nextUrl.searchParams.get('q') ?? (school ? `prior threats at ${school}` : 'recent school threats')

  try {
    const r = await fetch(`${SUPERMEMORY_BASE}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q,
        limit: 10,
        container_tags: school ? [`school:${school}`] : ['kairos:threat'],
      }),
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      return NextResponse.json({ error: 'Supermemory search failed', status: r.status, detail: errText }, { status: 502 })
    }
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Supermemory request failed', detail: String(err) }, { status: 502 })
  }
}
