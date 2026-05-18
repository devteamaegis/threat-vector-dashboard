import { NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_URL || 'https://threat-vector-production.up.railway.app'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET() {
  // 1. Try Railway backend (has Sponge API access + balance)
  try {
    const r = await fetch(`${BACKEND}/api/sponge/wallet`, { cache: 'no-store' })
    if (r.ok) {
      const data = await r.json()
      // If backend returned real data (non-demo transactions), use it
      const txs = data.transactions ?? []
      const hasRealData = txs.some((t: any) => t.tx_id && !t.tx_id.startsWith('demo'))
      if (hasRealData || txs.length === 0) {
        return NextResponse.json(data)
      }
    }
  } catch { /* fall through */ }

  // 2. Query Supabase sponge_transactions directly (anon key, RLS allows SELECT)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const [txRes, tipsRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/sponge_transactions?order=created_at.desc&limit=30`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/tips?select=ai_triage_score,school_name&order=created_at.desc&limit=1`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' }
        ),
      ])

      if (txRes.ok) {
        const rows: any[] = await txRes.json()
        const transactions = rows.map(row => ({
          service:    row.service ?? 'unknown',
          amount:     (row.amount_cents ?? 0) / 100,
          label:      SERVICE_LABELS[row.service as string] ?? row.service,
          icon:       SERVICE_ICONS[row.service as string] ?? '💰',
          call_id:    row.call_id,
          subject:    row.subject,
          tx_id:      row.tx_id,
          created_at: row.created_at,
        }))
        const totalSpend = transactions.reduce((s, t) => s + t.amount, 0)
        return NextResponse.json({ balance: 0, transactions, totalSpend })
      }
    } catch { /* fall through */ }
  }

  // 3. No data at all — return empty (never show fake transactions)
  return NextResponse.json({ balance: 0, transactions: [] })
}

const SERVICE_LABELS: Record<string, string> = {
  'background-check-agent': 'Background Check',
  'browser-use-osint':      'OSINT Search',
  'twilio-sms':             'SMS Alert',
  'agentmail-brief':        'Email Brief',
  'gemini-verify':          'Gemini Verify',
  'supermemory-store':      'Memory Store',
}
const SERVICE_ICONS: Record<string, string> = {
  'background-check-agent': '🕵️',
  'browser-use-osint':      '🔍',
  'twilio-sms':             '📱',
  'agentmail-brief':        '✉️',
  'gemini-verify':          '✦',
  'supermemory-store':      '🧬',
}
