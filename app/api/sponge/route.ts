import { NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8001'

// Demo fallback when backend is offline — always shows the agent economy story
const DEMO_DATA = {
  balance: 4.73,
  transactions: [
    { service: 'browser-use-osint', amount: 0.02, label: 'OSINT Search', icon: '🔍', call_id: 'demo-001' },
    { service: 'twilio-sms',        amount: 0.01, label: 'SMS Alert',    icon: '📱', call_id: 'demo-001' },
    { service: 'agentmail-brief',   amount: 0.01, label: 'Email Brief',  icon: '✉️', call_id: 'demo-001' },
    { service: 'gemini-verify',     amount: 0.03, label: 'Gemini Verify',icon: '✦',  call_id: 'demo-002' },
    { service: 'browser-use-osint', amount: 0.02, label: 'OSINT Search', icon: '🔍', call_id: 'demo-002' },
    { service: 'twilio-sms',        amount: 0.01, label: 'SMS Alert',    icon: '📱', call_id: 'demo-002' },
    { service: 'supermemory-store', amount: 0.005,label: 'Memory Store', icon: '🧬', call_id: 'demo-003' },
    { service: 'agentmail-brief',   amount: 0.01, label: 'Email Brief',  icon: '✉️', call_id: 'demo-003' },
  ],
}

export async function GET() {
  try {
    const r = await fetch(`${BACKEND}/api/sponge/wallet`, { next: { revalidate: 30 } })
    if (!r.ok) throw new Error('backend unreachable')
    return NextResponse.json(await r.json())
  } catch {
    return NextResponse.json(DEMO_DATA)
  }
}
