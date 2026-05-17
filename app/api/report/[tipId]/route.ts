import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tipId: string }> }
) {
  const { tipId } = await params

  const supabase = getSupabase()
  const { data: tip, error } = await supabase
    .from('tips')
    .select('*')
    .eq('id', tipId)
    .single()

  if (error || !tip) {
    return new NextResponse('Tip not found', { status: 404 })
  }

  const html = generateReportHTML(tip)
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateReportHTML(tip: any): string {
  const safeStr = (v: unknown, fallback = '—') =>
    v != null && v !== '' ? String(v) : fallback

  const safeNum = (v: unknown, fallback = '—') =>
    v != null ? String(v) : fallback

  const capitalize = (s: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—'

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
      })
    } catch { return iso }
  }

  const urgency     = safeStr(tip.urgency, 'unknown').toUpperCase()
  const urgencyColor = urgency === 'CRITICAL' ? '#cc0000'
    : urgency === 'HIGH' ? '#c05000'
    : urgency === 'MEDIUM' ? '#7a6000'
    : '#444444'
  const urgencyBg = urgency === 'CRITICAL' ? '#cc0000'
    : urgency === 'HIGH' ? '#e56a00'
    : urgency === 'MEDIUM' ? '#b99000'
    : '#5a5a5a'
  const bayesPct = typeof tip.bayes_probability_pct === 'number'
    ? Math.max(0, Math.min(100, tip.bayes_probability_pct))
    : 0

  const reportDate  = formatDate(tip.submitted_at ?? tip.created_at)
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })
  const tipId       = safeStr(tip.id)

  // Key facts list
  const keyFactsHTML = Array.isArray(tip.key_facts) && tip.key_facts.length > 0
    ? tip.key_facts.map((f: string) => `<li>${escHtml(f)}</li>`).join('\n')
    : '<li>No key facts recorded.</li>'

  // Credibility signals
  const credSignalsHTML = Array.isArray(tip.credibility_signals) && tip.credibility_signals.length > 0
    ? tip.credibility_signals.map((s: string) => `<li>${escHtml(s)}</li>`).join('\n')
    : ''

  // Bayesian drivers
  const bayesDriversHTML = Array.isArray(tip.bayes_top_drivers) && tip.bayes_top_drivers.length > 0
    ? `<table class="data-table">
        <thead><tr><th>Feature</th><th>Keyword</th><th>Ratio</th></tr></thead>
        <tbody>
          ${tip.bayes_top_drivers.map((d: { feature: string; keyword: string; ratio: number }) =>
            `<tr><td>${escHtml(d.feature)}</td><td>${escHtml(d.keyword)}</td><td>${d.ratio?.toFixed(2) ?? '—'}</td></tr>`
          ).join('\n')}
        </tbody>
      </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Threat Assessment Report — ${escHtml(safeStr(tip.school_name, 'Unknown School'))}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }

    .page {
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 48px;
    }

    /* ── Header ── */
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .wordmark {
      font-size: 28pt;
      font-weight: 950;
      letter-spacing: 0.08em;
      color: #cc0000;
      line-height: 0.95;
      text-transform: uppercase;
    }
    .report-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #0d0d0d;
      line-height: 1.1;
    }
    .report-subtitle {
      font-size: 8pt;
      color: #666;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .confidential-badge {
      font-size: 11pt;
      font-weight: 800;
      color: #cc0000;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border: 2px solid #cc0000;
      padding: 4px 10px;
      white-space: nowrap;
      align-self: flex-start;
    }
    .urgency-banner {
      margin: 14px 0 14px;
      padding: 10px 14px;
      background: ${urgencyBg};
      color: #fff;
      font-size: 11pt;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .urgency-banner span:last-child {
      font-size: 8pt;
      font-weight: 700;
      opacity: 0.86;
    }

    hr.thick {
      border: none;
      border-top: 2.5px solid #0d0d0d;
      margin: 10px 0 4px;
    }
    hr.thin {
      border: none;
      border-top: 1px solid #d0d0d0;
      margin: 16px 0;
    }

    .meta-row {
      display: flex;
      gap: 32px;
      font-size: 8.5pt;
      color: #555;
      margin-bottom: 4px;
    }
    .meta-row span { white-space: nowrap; }
    .meta-bold { font-weight: 600; color: #222; }

    /* ── Sections ── */
    .section {
      margin-bottom: 20px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .section-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #333;
      border-bottom: 1px solid #ccc;
      padding-bottom: 3px;
      margin-bottom: 10px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px 24px;
    }

    .field-label {
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #777;
      margin-bottom: 2px;
    }
    .field-value {
      font-size: 10.5pt;
      color: #111;
      line-height: 1.4;
    }

    .urgency-tag {
      display: inline-block;
      font-size: 10pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${urgencyColor};
      border: 2px solid ${urgencyColor};
      padding: 2px 8px;
    }

    .ai-summary-box {
      background: #f8f8f8;
      border-left: 4px solid #333;
      padding: 10px 14px;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #111;
    }

    .model-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }
    .model-box {
      border: 1px solid #ddd;
      padding: 8px 10px;
      text-align: center;
    }
    .model-box .model-name { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.12em; color: #888; margin-bottom: 3px; }
    .model-box .model-val  { font-size: 13pt; font-weight: 800; color: #111; }
    .model-box .model-val.consensus-yes { color: #1a7a3a; }
    .model-box .model-val.consensus-no  { color: #b05000; }
    .probability-card {
      border: 1px solid #d7d7d7;
      background: #fbfbfb;
      padding: 12px 14px;
      margin-bottom: 12px;
    }
    .probability-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
    }
    .probability-label {
      font-size: 8pt;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #555;
    }
    .probability-value {
      font-size: 18pt;
      font-weight: 950;
      color: ${urgencyColor};
    }
    .probability-track {
      height: 12px;
      border: 1px solid #cfcfcf;
      background: #eee;
      overflow: hidden;
    }
    .probability-fill {
      height: 100%;
      width: ${bayesPct}%;
      background: linear-gradient(90deg, #888, ${urgencyColor});
    }

    .key-facts-list {
      margin: 0;
      padding-left: 18px;
      font-size: 10.5pt;
      line-height: 1.7;
      color: #222;
    }

    .transcript-box {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9.5pt;
      background: #f1f3f5;
      border: 1px solid #d8dde3;
      padding: 12px 14px;
      line-height: 1.6;
      color: #333;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .dispatch-box {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9.5pt;
      background: #fff5f5;
      border: 1px solid #f0a0a0;
      border-left: 4px solid #cc0000;
      padding: 10px 14px;
      line-height: 1.6;
      color: #3a0000;
      white-space: pre-wrap;
    }

    .alert-box {
      background: #f9f0ff;
      border: 1px solid #c090e0;
      border-left: 4px solid #7722cc;
      padding: 10px 14px;
      font-size: 10.5pt;
      line-height: 1.5;
      color: #2a0055;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }
    .data-table th {
      background: #f0f0f0;
      border: 1px solid #ccc;
      padding: 5px 8px;
      text-align: left;
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .data-table td {
      border: 1px solid #ddd;
      padding: 4px 8px;
      color: #333;
    }

    /* ── Footer ── */
    .report-footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 2px solid #0d0d0d;
      font-size: 7.5pt;
      color: #666;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-left { line-height: 1.6; }
    .footer-right { text-align: right; line-height: 1.6; }

    /* ── Print button ── */
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #0d0d0d;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 24px;
      z-index: 100;
      font-size: 10pt;
    }
    .print-bar .bar-title { font-weight: 600; letter-spacing: 0.06em; }
    .print-bar .bar-right { display: flex; gap: 12px; align-items: center; }
    .print-btn {
      background: #fff;
      color: #0d0d0d;
      border: none;
      padding: 6px 18px;
      font-size: 10pt;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.04em;
    }
    .print-btn:hover { background: #e8e8e8; }

    @media print {
      body { margin: 0; }
      .page { padding: 20px 28px; }
      .no-print { display: none !important; }
      .print-bar { display: none !important; }
      .section, .model-grid, .probability-card, .transcript-box, .dispatch-box, .alert-box {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

<!-- Print bar (hidden when printing) -->
<div class="print-bar no-print">
  <span class="bar-title">THREAT VECTOR — Threat Assessment Report</span>
  <div class="bar-right">
    <span style="font-size:9pt;opacity:0.5;">Tip ID: ${escHtml(tipId.substring(0, 20))}${tipId.length > 20 ? '…' : ''}</span>
    <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>
</div>

<div class="page" style="margin-top: 52px;">

  <!-- ── Report Header ── -->
  <div class="report-header">
    <div>
      <div class="wordmark">THREAT VECTOR</div>
      <div class="report-title">THREAT ASSESSMENT REPORT</div>
      <div class="report-subtitle">Threat Vector AI System &nbsp;·&nbsp; School Safety Command Center</div>
    </div>
    <div class="confidential-badge">Confidential</div>
  </div>

  <hr class="thick" />

  <div class="meta-row" style="margin-top: 8px;">
    <span>Report Date: <span class="meta-bold">${escHtml(reportDate)}</span></span>
    <span>Report ID: <span class="meta-bold">${escHtml(tipId)}</span></span>
  </div>
  <div class="meta-row">
    <span>Generated: <span class="meta-bold">${escHtml(generatedAt)}</span></span>
    <span>Classification: <span class="meta-bold" style="color:#cc0000;">FOR AUTHORIZED PERSONNEL ONLY</span></span>
  </div>

  <div class="urgency-banner">
    <span>${escHtml(urgency)} URGENCY</span>
    <span>${escHtml(safeStr(tip.ai_recommended_action, 'Immediate review')).replace(/_/g, ' ')}</span>
  </div>

  <hr class="thin" />

  <!-- ── 1. Incident Summary ── -->
  <div class="section">
    <div class="section-title">1 &nbsp;· &nbsp;Incident Summary</div>
    <div class="grid-2">
      <div>
        <div class="field-label">School / Facility</div>
        <div class="field-value">${escHtml(safeStr(tip.school_name, 'Not specified'))}</div>
      </div>
      <div>
        <div class="field-label">Incident Date / Time</div>
        <div class="field-value">${escHtml(formatDate(tip.submitted_at ?? tip.created_at))}</div>
      </div>
      <div>
        <div class="field-label">Urgency Level</div>
        <div class="field-value"><span class="urgency-tag">${escHtml(urgency)}</span></div>
      </div>
      <div>
        <div class="field-label">Threat Category</div>
        <div class="field-value">${escHtml(capitalize(safeStr(tip.category)))}</div>
      </div>
      <div>
        <div class="field-label">Status</div>
        <div class="field-value">${escHtml(capitalize(safeStr(tip.status)))}</div>
      </div>
      <div>
        <div class="field-label">Anonymous Tip</div>
        <div class="field-value">${tip.is_anonymous ? 'Yes — Caller identity protected' : 'No'}</div>
      </div>
    </div>
  </div>

  <!-- ── 2. AI Threat Assessment ── -->
  <div class="section">
    <div class="section-title">2 &nbsp;· &nbsp;AI Threat Assessment</div>
    ${tip.ai_summary ? `
    <div class="ai-summary-box" style="margin-bottom: 12px;">
      ${escHtml(tip.ai_summary)}
    </div>` : ''}
    <div class="grid-2">
      <div>
        <div class="field-label">AI Triage Score</div>
        <div class="field-value">${escHtml(safeNum(tip.ai_triage_score ?? tip.ai_score))} / 10</div>
      </div>
      <div>
        <div class="field-label">Recommended Action</div>
        <div class="field-value">${escHtml(capitalize(safeStr(tip.ai_recommended_action)))}</div>
      </div>
    </div>
  </div>

  <!-- ── 3. Multi-Model Analysis ── -->
  <div class="section">
    <div class="section-title">3 &nbsp;· &nbsp;Multi-Model Analysis</div>
    <div class="probability-card">
      <div class="probability-row">
        <div class="probability-label">Bayesian Probability</div>
        <div class="probability-value">${tip.bayes_probability_pct != null ? `${escHtml(String(tip.bayes_probability_pct))}%` : '—'}</div>
      </div>
      <div class="probability-track"><div class="probability-fill"></div></div>
      <div style="margin-top:6px;font-size:8pt;color:#666;">
        Confidence interval: ${tip.bayes_ci_low_pct != null ? escHtml(String(tip.bayes_ci_low_pct)) : '—'}% to ${tip.bayes_ci_high_pct != null ? escHtml(String(tip.bayes_ci_high_pct)) : '—'}%
      </div>
    </div>
    <div class="model-grid">
      <div class="model-box">
        <div class="model-name">Claude (Anthropic)</div>
        <div class="model-val">${escHtml(safeNum(tip.ai_triage_score ?? tip.ai_score))} / 10</div>
      </div>
      <div class="model-box">
        <div class="model-name">Gemini Level</div>
        <div class="model-val">${escHtml(safeNum(tip.gemini_level))} / 5</div>
      </div>
      <div class="model-box">
        <div class="model-name">Bayesian</div>
        <div class="model-val">${tip.bayes_probability_pct != null ? `${tip.bayes_probability_pct}%` : '—'}</div>
      </div>
    </div>
    <div style="border:1px solid #ddd;padding:8px 10px;margin-bottom:8px;font-size:10pt;font-weight:800;color:${tip.consensus ? '#1a7a3a' : tip.consensus === false ? '#b05000' : '#555'};">
      Consensus: ${tip.consensus === true ? 'CONFIRMED' : tip.consensus === false ? 'DIVERGENT' : 'PENDING'}
    </div>
    ${tip.gemini_reasoning ? `
    <div>
      <div class="field-label">Gemini Reasoning</div>
      <div class="field-value" style="font-style:italic;color:#444;">${escHtml(tip.gemini_reasoning)}</div>
    </div>` : ''}
    ${bayesDriversHTML ? `
    <div style="margin-top: 10px;">
      <div class="field-label" style="margin-bottom:6px;">Bayesian Top Drivers</div>
      ${bayesDriversHTML}
    </div>` : ''}
    ${tip.three_model_consensus ? `
    <div style="margin-top:8px;font-size:9pt;font-weight:700;color:#1a7a3a;">
      ✓ Three-model consensus confirmed
    </div>` : ''}
  </div>

  <!-- ── 4. Caller Analysis ── -->
  ${(tip.caller_emotion || tip.caller_tone || tip.escalation_risk || tip.call_duration_seconds) ? `
  <div class="section">
    <div class="section-title">4 &nbsp;· &nbsp;Caller Analysis</div>
    <div class="grid-3">
      ${tip.caller_emotion ? `
      <div>
        <div class="field-label">Emotional State</div>
        <div class="field-value">${escHtml(capitalize(tip.caller_emotion))}</div>
      </div>` : ''}
      ${tip.caller_tone ? `
      <div>
        <div class="field-label">Vocal Tone</div>
        <div class="field-value">${escHtml(capitalize(tip.caller_tone))}</div>
      </div>` : ''}
      ${tip.escalation_risk ? `
      <div>
        <div class="field-label">Escalation Risk</div>
        <div class="field-value" style="font-weight:700;${tip.escalation_risk === 'imminent' ? 'color:#cc0000;' : tip.escalation_risk === 'escalating' ? 'color:#b05000;' : 'color:#1a7a3a;'}">${escHtml(capitalize(tip.escalation_risk))}</div>
      </div>` : ''}
      ${tip.call_duration_seconds != null ? `
      <div>
        <div class="field-label">Call Duration</div>
        <div class="field-value">${tip.call_duration_seconds} seconds</div>
      </div>` : ''}
      ${tip.caller_language ? `
      <div>
        <div class="field-label">Caller Language</div>
        <div class="field-value">${escHtml(tip.caller_language)}${tip.multilingual_call ? ' (auto-translated)' : ''}</div>
      </div>` : ''}
    </div>
  </div>` : ''}

  <!-- ── 5. Credibility Signals ── -->
  ${credSignalsHTML ? `
  <div class="section">
    <div class="section-title">5 &nbsp;· &nbsp;Credibility Signals</div>
    <ul class="key-facts-list">
      ${credSignalsHTML}
    </ul>
  </div>` : ''}

  <!-- ── 6. Key Facts ── -->
  <div class="section">
    <div class="section-title">${credSignalsHTML ? '6' : '5'} &nbsp;· &nbsp;Key Facts</div>
    <ul class="key-facts-list">
      ${keyFactsHTML}
    </ul>
  </div>

  <!-- ── 7. Timeline & Location ── -->
  ${(tip.timeline || tip.location_detail || tip.threat_window) ? `
  <div class="section">
    <div class="section-title">7 &nbsp;· &nbsp;Timeline &amp; Location</div>
    <div class="grid-2">
      ${tip.timeline ? `
      <div>
        <div class="field-label">Threat Timeline</div>
        <div class="field-value">${escHtml(capitalize(tip.timeline))}</div>
      </div>` : ''}
      ${tip.threat_window ? `
      <div>
        <div class="field-label">Predicted Threat Window</div>
        <div class="field-value" style="font-weight:600;color:#993300;">${escHtml(tip.threat_window)}</div>
      </div>` : ''}
      ${tip.location_detail ? `
      <div>
        <div class="field-label">Location Detail</div>
        <div class="field-value">${escHtml(tip.location_detail)}</div>
      </div>` : ''}
      ${tip.subject_description ? `
      <div>
        <div class="field-label">Subject Description</div>
        <div class="field-value">${escHtml(tip.subject_description)}</div>
      </div>` : ''}
    </div>
  </div>` : ''}

  <!-- ── 8. Transcript ── -->
  <div class="section">
    <div class="section-title">8 &nbsp;· &nbsp;Caller Transcript</div>
    <div class="transcript-box">${escHtml(safeStr(tip.description, 'No transcript available.'))}</div>
    ${tip.english_translation ? `
    <div style="margin-top:8px;">
      <div class="field-label">English Translation (Gemini Live)</div>
      <div class="transcript-box" style="background:#f0f8ff;border-color:#a0c8f0;">${escHtml(tip.english_translation)}</div>
    </div>` : ''}
  </div>

  <!-- ── 9. 911 Dispatch Brief ── -->
  ${tip.dispatch_brief ? `
  <div class="section">
    <div class="section-title">9 &nbsp;· &nbsp;911 Dispatch Brief</div>
    <div class="dispatch-box">${escHtml(tip.dispatch_brief)}</div>
  </div>` : ''}

  <!-- ── 10. Cross-School Alert ── -->
  ${tip.cross_school_alert ? `
  <div class="section">
    <div class="section-title">10 &nbsp;· &nbsp;Cross-School Pattern Alert</div>
    <div class="alert-box">${escHtml(tip.cross_school_alert)}</div>
  </div>` : ''}

  <!-- ── Footer ── -->
  <hr class="thick" />
  <div class="report-footer">
    <div class="footer-left">
      <div style="font-weight:700;font-size:8pt;letter-spacing:0.1em;">THREAT VECTOR AI SYSTEM</div>
      <div>Generated by automated AI analysis pipeline</div>
      <div>Report ID: ${escHtml(tipId)}</div>
    </div>
    <div class="footer-right">
      <div style="font-weight:700;color:#cc0000;">CONFIDENTIAL</div>
      <div>For Authorized Personnel Only</div>
      <div>Page 1 of 1</div>
      <div>Do not distribute or reproduce without authorization</div>
    </div>
  </div>

</div>
</body>
</html>`
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
