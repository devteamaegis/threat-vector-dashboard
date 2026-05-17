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
