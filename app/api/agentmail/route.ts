import { NextRequest, NextResponse } from 'next/server'

const AGENTMAIL_BASE = 'https://api.agentmail.to/v0'

// Sends a structured threat brief to a district safety officer using AgentMail.
// Body: { tip: TipRow, report: ThreatReport, transcript: string }
//
// Behaviour:
//   - Requires AGENTMAIL_API_KEY
//   - Sends to AGENTMAIL_TO (single recipient or comma-separated list)
//   - Sender is the AgentMail inbox configured under AGENTMAIL_INBOX_ID (optional;
//     if not set, AgentMail will pick the default inbox on the account)
//   - Idempotent on tip.id to avoid double-sends if the inbound endpoint retries
export async function POST(req: NextRequest) {
  const apiKey = process.env.AGENTMAIL_API_KEY
  const recipients = (process.env.AGENTMAIL_TO ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const inboxId = process.env.AGENTMAIL_INBOX_ID // optional

  if (!apiKey) return NextResponse.json({ error: 'AGENTMAIL_API_KEY not set' }, { status: 500 })
  if (recipients.length === 0) return NextResponse.json({ error: 'AGENTMAIL_TO not set' }, { status: 500 })

  const body = await req.json()
  const tip = body.tip ?? {}
  const report = body.report ?? {}
  const transcript = String(body.transcript ?? tip.description ?? '')

  const subject = `[Kairos] ${tip.urgency?.toUpperCase() ?? 'TIP'} · ${tip.school_name ?? 'Unknown'} · Level ${tip.threat_level ?? '?'}`

  // Plain-text and HTML are both included; AgentMail will serve the right one.
  const text = renderText(tip, report, transcript)
  const html = renderHtml(tip, report, transcript)

  // ── Resolve the from-inbox ─────────────────────────────────────────────────
  let resolvedInboxId = inboxId
  try {
    if (!resolvedInboxId) {
      const r = await fetch(`${AGENTMAIL_BASE}/inboxes`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (r.ok) {
        const data = await r.json()
        const first = Array.isArray(data) ? data[0] : data.inboxes?.[0]
        resolvedInboxId = first?.inbox_id ?? first?.id
      }
    }
    // Create one if none exists yet
    if (!resolvedInboxId) {
      const r = await fetch(`${AGENTMAIL_BASE}/inboxes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: 'Kairos Threat Briefings' }),
      })
      if (r.ok) {
        const data = await r.json()
        resolvedInboxId = data.inbox_id ?? data.id
      }
    }
  } catch (err) {
    return NextResponse.json({ error: 'AgentMail inbox resolution failed', detail: String(err) }, { status: 502 })
  }

  if (!resolvedInboxId) {
    return NextResponse.json({ error: 'Could not resolve AgentMail inbox' }, { status: 502 })
  }

  // ── Send the message ───────────────────────────────────────────────────────
  try {
    const r = await fetch(`${AGENTMAIL_BASE}/inboxes/${resolvedInboxId}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        subject,
        text,
        html,
      }),
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      return NextResponse.json({ error: 'AgentMail send failed', status: r.status, detail: errText }, { status: 502 })
    }
    const data = await r.json().catch(() => ({}))
    return NextResponse.json({ ok: true, agentmail: data, sent_to: recipients, inbox_id: resolvedInboxId })
  } catch (err) {
    return NextResponse.json({ error: 'AgentMail request failed', detail: String(err) }, { status: 502 })
  }
}

function renderText(tip: Record<string, unknown>, report: Record<string, unknown>, transcript: string): string {
  const bayes = (report.bayes ?? {}) as { mean?: number; ci95?: [number, number]; pEscalation?: number }
  return [
    `KAIROS THREAT BRIEF`,
    `=====================`,
    ``,
    `School:       ${tip.school_name ?? 'Unknown'}`,
    `Level:        ${tip.threat_level ?? '?'} / 5  (${tip.urgency ?? 'unknown'})`,
    `Category:     ${tip.category ?? 'unknown'}`,
    `Emotion:      ${tip.caller_emotion ?? 'unknown'} (${tip.caller_tone ?? 'neutral'})`,
    `Escalation:   ${tip.escalation_risk ?? 'unknown'}`,
    ``,
    `MATH`,
    `----`,
    `Posterior μ:    ${bayes.mean?.toFixed(2) ?? '?'}`,
    `95% CI:         [${bayes.ci95?.[0]?.toFixed(2) ?? '?'}, ${bayes.ci95?.[1]?.toFixed(2) ?? '?'}]`,
    `P(escalation):  ${((bayes.pEscalation ?? 0) * 100).toFixed(1)}%`,
    ``,
    `AI SUMMARY`,
    `----------`,
    String(tip.ai_summary ?? ''),
    ``,
    `KEY FACTS`,
    `---------`,
    ...(Array.isArray(tip.key_facts) ? tip.key_facts.map((f: unknown) => `• ${String(f)}`) : []),
    ``,
    `RECOMMENDED ACTION`,
    `------------------`,
    String(tip.ai_recommended_action ?? 'review'),
    ``,
    `TRANSCRIPT`,
    `----------`,
    transcript,
    ``,
    `— Kairos AI`,
  ].join('\n')
}

function renderHtml(tip: Record<string, unknown>, report: Record<string, unknown>, transcript: string): string {
  const bayes = (report.bayes ?? {}) as { mean?: number; ci95?: [number, number]; pEscalation?: number }
  const urgency = String(tip.urgency ?? 'medium')
  const urgencyColor = urgency === 'critical' ? '#ef4444' : urgency === 'high' ? '#f97316' : urgency === 'medium' ? '#eab308' : '#64748b'
  const facts = Array.isArray(tip.key_facts) ? tip.key_facts.map((f: unknown) => `<li>${escapeHtml(String(f))}</li>`).join('') : ''
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8f9fb;padding:24px;color:#09090b;max-width:680px;margin:auto">
  <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;box-shadow:0 8px 24px rgba(0,0,0,0.06)">
    <div style="background:${urgencyColor};color:white;padding:20px 24px;font-weight:800;letter-spacing:0.05em;">
      KAIROS · ${urgency.toUpperCase()} · LEVEL ${escapeHtml(String(tip.threat_level ?? '?'))} / 5
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px 0">${escapeHtml(String(tip.school_name ?? 'Unknown school'))}</h2>
      <p style="font-size:15px;line-height:1.6;color:#3f3f46">${escapeHtml(String(tip.ai_summary ?? ''))}</p>

      <h3 style="margin-top:24px;font-size:13px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a">Math</h3>
      <table style="font-size:13px;width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#71717a">Posterior μ</td><td style="text-align:right;font-family:monospace">${bayes.mean?.toFixed(2) ?? '?'}</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">95% CI</td><td style="text-align:right;font-family:monospace">[${bayes.ci95?.[0]?.toFixed(2) ?? '?'}, ${bayes.ci95?.[1]?.toFixed(2) ?? '?'}]</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">P(escalation ≥ 4)</td><td style="text-align:right;font-family:monospace;color:${urgencyColor};font-weight:700">${((bayes.pEscalation ?? 0) * 100).toFixed(1)}%</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">Caller emotion</td><td style="text-align:right">${escapeHtml(String(tip.caller_emotion ?? ''))}</td></tr>
      </table>

      <h3 style="margin-top:24px;font-size:13px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a">Key facts</h3>
      <ul style="font-size:14px;line-height:1.7">${facts}</ul>

      <h3 style="margin-top:24px;font-size:13px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a">Recommended action</h3>
      <div style="padding:12px 16px;border-radius:10px;background:${urgencyColor}1A;color:${urgencyColor};font-weight:700">${escapeHtml(String(tip.ai_recommended_action ?? 'review'))}</div>

      <h3 style="margin-top:24px;font-size:13px;text-transform:uppercase;letter-spacing:0.15em;color:#71717a">Transcript</h3>
      <pre style="white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f3f4f6;padding:16px;border-radius:10px;font-size:13px;line-height:1.5;color:#3f3f46">${escapeHtml(transcript)}</pre>
    </div>
    <div style="background:#f3f4f6;padding:14px 24px;font-size:11px;color:#71717a;border-top:1px solid #e4e4e7">— Kairos AI · sent via AgentMail</div>
  </div></body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}
