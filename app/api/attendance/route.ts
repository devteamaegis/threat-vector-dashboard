import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('absence_date', today)
    .order('submitted_at', { ascending: false })
    .limit(250)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST() {
  const apiKey = process.env.AGENTMAIL_API_KEY
  const inboxId = process.env.AGENTMAIL_INBOX_ID || process.env.AGENTMAIL_INBOX
  const recipient = process.env.ATTENDANCE_NOTIFY_EMAIL || process.env.SAFETY_OFFICER_EMAIL

  if (!apiKey || apiKey === 'FILL_IN' || !inboxId || inboxId === 'FILL_IN' || !recipient) {
    return NextResponse.json({ error: 'AgentMail attendance notification env vars are not configured' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('absence_date', today)
    .order('submitted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bySchool = (data ?? []).reduce<Record<string, typeof data>>((acc, log) => {
    const school = log.school_name || 'Unknown School'
    acc[school] = acc[school] ? [...acc[school], log] : [log]
    return acc
  }, {})

  const sent: string[] = []
  for (const [school, logs] of Object.entries(bySchool)) {
    const lines = logs.map(log =>
      `- ${log.student_name || 'Unknown student'} | ${log.teacher_name || log.grade || 'Teacher not listed'} | ${log.reason || 'No reason provided'}`
    )
    const text = [
      `Attendance summary for ${school}`,
      `Date: ${today}`,
      '',
      ...lines,
    ].join('\n')

    const r = await fetch(`https://api.agentmail.to/v0/inboxes/${inboxId}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipient,
        subject: `[Threat Vector Attendance] ${school} - ${logs.length} absent today`,
        text,
        html: `<div style="font-family:system-ui,sans-serif"><h2>${school}</h2><p>${logs.length} students absent today.</p><pre>${text}</pre></div>`,
      }),
    })

    if (!r.ok) {
      const message = await r.text()
      return NextResponse.json({ error: `AgentMail failed for ${school}: ${message.slice(0, 200)}` }, { status: 502 })
    }
    sent.push(school)
  }

  return NextResponse.json({ status: 'sent', schools: sent, count: sent.length })
}
