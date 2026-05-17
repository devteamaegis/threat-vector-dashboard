import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Tip = {
  id: string
  description: string
  category: string
  urgency: string
  severity?: string
  priority?: string
  status: string
  is_anonymous: boolean
  ai_summary: string | null
  ai_score?: number | null
  ai_triage_score?: number | null
  ai_recommended_action?: string | null
  school_name?: string | null
  notes?: string | null
  submitted_at?: string
  created_at: string
  // AI enrichment fields
  caller_emotion?: string | null
  caller_tone?: string | null
  escalation_risk?: string | null
  credibility_signals?: string[] | null
  key_facts?: string[] | null
  timeline?: string | null
  location_detail?: string | null
  subject_description?: string | null
  call_duration_seconds?: number | null
}
