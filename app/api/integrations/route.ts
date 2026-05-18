import { NextResponse } from 'next/server'

export async function GET() {
  const backendUrl = process.env.BACKEND_URL || 'https://threat-vector-production.up.railway.app'
  try {
    const r = await fetch(`${backendUrl}/health`, { next: { revalidate: 30 } })
    if (!r.ok) throw new Error('backend unreachable')
    const data = await r.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({
      status: 'backend_offline',
      integrations: {
        anthropic: false, supabase: true, twilio: false,
        agentphone: false, agentmail: false, supermemory: false,
        moss: false, stripe: false, sponge: false,
      }
    })
  }
}
