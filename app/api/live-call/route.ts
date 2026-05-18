import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Polling fallback for live call status — used when Supabase Realtime
 * is not enabled for the live_calls table. The dashboard polls every 2s.
 * Returns the most recently updated live_calls row (active or complete).
 */
export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(null)
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/live_calls?order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
      }
    )
    if (!r.ok) return NextResponse.json(null)
    const rows = await r.json()
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json(null)
    const row = rows[0]

    // Only surface rows updated in the last 60s — stale rows shouldn't drive the orb
    const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0
    if (Date.now() - updatedAt > 60_000) return NextResponse.json(null)

    return NextResponse.json({
      call_id:       row.call_id,
      status:        row.status,
      words_so_far:  row.words_so_far,
      probability_pct: row.probability_pct,
      threat_level:  row.threat_level,
      school_name:   row.school_name,
      top_features:  row.top_features,
      updated_at:    row.updated_at,
    })
  } catch {
    return NextResponse.json(null)
  }
}
