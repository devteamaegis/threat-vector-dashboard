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
  caller_language?: string | null
  multilingual_call?: boolean | null
  english_translation?: string | null
  gemini_level?: number | null
  gemini_reasoning?: string | null
  consensus?: boolean | null
  s3_archive_uri?: string | null
  cross_school_alert?: string | null
  threat_window?: string | null
  dispatch_brief?: string | null
  bayes_probability_pct?: number | null
  bayes_ci_low_pct?: number | null
  bayes_ci_high_pct?: number | null
  bayes_features_hit?: string[] | null
  bayes_top_drivers?: Array<{ feature?: string; keyword: string; ratio?: number; weight?: number }> | null
  three_model_consensus?: boolean | null
  threat_level?: number | null
  call_lat?: number | null
  call_lng?: number | null
  location_context?: string | null
}

export type AttendanceLog = {
  id: string
  call_id?: string | null
  school_name?: string | null
  student_name?: string | null
  teacher_name?: string | null
  grade?: string | null
  absence_date?: string | null
  reason?: string | null
  submitted_at: string
}
