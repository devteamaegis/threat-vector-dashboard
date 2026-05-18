'use client'

export const dynamic = 'force-dynamic'

const SPONSORS = [
  {
    name: 'AgentPhone',
    color: '#3b82f6',
    provides: 'Voice infrastructure',
    technical:
      'Provides the phone number, call transcription webhook, and callId. Webhook fires POST /webhook/call with {data: {callId, transcript: [{role, content}], durationSeconds}}.',
    without: 'No calls enter the system at all.',
  },
  {
    name: 'Claude (Anthropic)',
    color: '#f97316',
    provides: 'Primary threat classifier',
    technical:
      'classify_threat() sends the transcript to claude-sonnet-4-5 with a structured prompt returning JSON: {threat_level: 1-5, threat_type, school_name, summary, recommended_action, caller_emotion}. Called twice per pipeline — raw, then Moss-enriched.',
    without: 'No threat level, no triage. Every call is unclassified.',
  },
  {
    name: 'Gemini (Google DeepMind)',
    color: '#4ade80',
    provides: 'Multilingual translation + second-opinion verification',
    technical:
      'Role 1: Gemini Live (gemini-2.0-flash-live-001) detects non-English and translates before Claude sees text — 70 languages. Role 2: gemini_verify() runs gemini-2.5-flash independently, forms the 3-model consensus with Claude + Bayesian.',
    without: 'Non-English calls go unprocessed. 3-model consensus collapses to 2.',
  },
  {
    name: 'Supabase',
    color: '#22c55e',
    provides: 'Real-time database + pub/sub',
    technical:
      "Every tip stored as a row in the 'tips' table. Dashboard subscribes via supabase.channel('tips-live').on('postgres_changes', {event:'INSERT', schema:'public', table:'tips'}, ...). Two tables: tips (50+ cols) and live_calls (real-time streaming).",
    without: 'No dashboard, no persistence, no real-time feed.',
  },
  {
    name: 'Supermemory',
    color: '#8b5cf6',
    provides: 'Persistent behavioral memory',
    technical:
      "store_tip_memory() embeds every tip as a semantic vector in namespace 'kairos-threats'. search_prior_tips() retrieves top-3 semantically similar past tips before Claude's second pass. Prior context injected as [Prior semantic context: ...] — changes threat level via Bayesian cross-tip multiplier (2x-5x).",
    without: 'Every call is a cold start. Cross-session behavioral patterns are invisible.',
  },
  {
    name: 'Twilio',
    color: '#ef4444',
    provides: 'SMS alerting',
    technical:
      'send_sms_alert() pages the principal\'s phone when threat level >= 3. Level 5 sends a second message to law enforcement contact. Uses client.messages.create() with body containing level, school, action, threat window, and 160-char AI summary.',
    without: 'Alerts are email-only. Principal is not paged in real time.',
  },
  {
    name: 'AgentMail',
    color: '#f59e0b',
    provides: 'Structured email briefs',
    technical:
      'generate_email_brief() builds a full HTML triage report. POSTed to /v1/inboxes/{inbox_id}/messages within seconds of call ending. Includes threat level, Bayesian CI, 3-model consensus, key facts, dispatch brief, and full transcript.',
    without: 'Safety officer receives no formatted brief. Email channel is silent.',
  },
  {
    name: 'AWS S3',
    color: '#f97316',
    provides: 'Immutable call archive',
    technical:
      'archive_transcript() uploads transcript + full classification JSON to threat-vector-calls/{school}/{date}/{call_id}.json. S3 URI stored in tips table s3_archive_uri column. Provides legal chain-of-custody evidence for law enforcement handoff.',
    without: 'No forensic record. No immutable audit trail for legal proceedings.',
  },
  {
    name: 'Sponge Wallet',
    color: '#a78bfa',
    provides: 'Autonomous micro-payments',
    technical:
      'Every agent service (OSINT, SMS, email, memory store, background check) triggers disburse_agent_payment(). authorize_background_check() fires before each OSINT lookup — threat_level x 1¢. Creates a verifiable financial audit trail of every AI decision. Logged to sponge_transactions Supabase table.',
    without: 'No autonomous payment trail. Agent economy collapses to free API calls.',
  },
  {
    name: 'Deepgram',
    color: '#06b6d4',
    provides: 'High-confidence audio transcription',
    technical:
      'transcribe_audio_url() re-transcribes the call at >85% confidence threshold using Nova-3. Provides per-word confidence scores, speaker diarization, and language detection. Overrides AgentPhone transcript when confidence > 0.85.',
    without: 'Lower-accuracy AgentPhone transcript is used for all classification.',
  },
  {
    name: 'Moss',
    color: '#84cc16',
    provides: 'Semantic context index',
    technical:
      "semantic_search_tips() queries the threat-vector-tips index before Claude's second pass. Returns top semantically similar tips. Context injected into enriched_transcript as [Prior semantic context: ...]. index_tip() upserts each processed call immediately after classification.",
    without: "Claude's final classification has no district history. Context injection skipped.",
  },
  {
    name: 'Browser Use',
    color: '#fb923c',
    provides: 'Autonomous OSINT',
    technical:
      'run_osint() spawns an AI browser agent for level 3+ threats. Browses public web sources to corroborate the threat subject description and school. Findings appended to osint_findings field in the tip record and surfaced in the dashboard detail view.',
    without: 'No web-based threat corroboration. OSINT field is empty for all tips.',
  },
]

const PIPELINE_STEPS = [
  { label: 'Phone Call', color: '#94a3b8' },
  { label: 'AgentPhone', color: '#3b82f6' },
  { label: 'Deepgram', color: '#06b6d4' },
  { label: 'Gemini Live', color: '#4ade80' },
  { label: 'Claude', color: '#f97316' },
  { label: 'Gemini Verify', color: '#4ade80' },
  { label: 'Bayesian MC', color: '#e2e8f0' },
  { label: 'Supermemory', color: '#8b5cf6' },
  { label: 'Moss', color: '#84cc16' },
  { label: 'Supabase', color: '#22c55e' },
  { label: 'Twilio / AgentMail', color: '#ef4444' },
]

function SponsorCard({ sponsor }: { sponsor: typeof SPONSORS[number] }) {
  return (
    <div
      className="group relative flex flex-col gap-3 rounded-2xl p-5 transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid rgba(255,255,255,0.07)`,
        boxShadow: `0 0 0 0 ${sponsor.color}00`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.border = `1px solid ${sponsor.color}55`
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 24px 0 ${sponsor.color}22`
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(255,255,255,0.07)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 0 transparent'
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: sponsor.color, boxShadow: `0 0 8px ${sponsor.color}` }}
        />
        <span
          className="font-black uppercase tracking-[0.2em] text-[13px]"
          style={{ color: sponsor.color }}
        >
          {sponsor.name}
        </span>
      </div>

      {/* Tag */}
      <div>
        <span
          className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: `${sponsor.color}18`,
            color: sponsor.color,
            border: `1px solid ${sponsor.color}33`,
          }}
        >
          {sponsor.provides}
        </span>
      </div>

      {/* Technical detail */}
      <p className="text-[11px] text-zinc-400 leading-relaxed font-mono flex-1">
        {sponsor.technical}
      </p>

      {/* Without */}
      <p className="text-[10px] text-red-400/70 leading-relaxed">
        <span className="font-semibold text-red-400/90">Without this: </span>
        {sponsor.without}
      </p>
    </div>
  )
}

export default function UseCasePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'rgba(6,8,13,1)', color: '#f1f5f9' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-500 font-bold mb-3">
            Kairos · Sponsor Architecture
          </div>
          <h1 className="text-4xl font-black mb-4 leading-tight">
            How Each Sponsor Powers Kairos
          </h1>
          <p className="text-base text-zinc-400 max-w-2xl leading-relaxed">
            Every component of the pipeline is built on sponsor technology — not as a wrapper,
            but as a core dependency. Remove any one of these and a measurable part of the threat
            detection system fails.
          </p>
        </div>

        {/* Sponsor grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SPONSORS.map((sponsor) => (
            <SponsorCard key={sponsor.name} sponsor={sponsor} />
          ))}
        </div>

        {/* Pipeline Flow */}
        <div className="mt-16">
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-500 font-bold mb-2">
            Pipeline Flow
          </div>
          <h2 className="text-2xl font-black mb-6">
            Every call runs this sequence
          </h2>

          {/* Desktop: horizontal scroll row */}
          <div className="hidden md:flex items-center gap-0 overflow-x-auto pb-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center flex-shrink-0">
                <div
                  className="px-3 py-2 rounded-full text-[11px] font-bold whitespace-nowrap"
                  style={{
                    background: `${step.color}18`,
                    border: `1px solid ${step.color}55`,
                    color: step.color,
                    boxShadow: `0 0 10px ${step.color}22`,
                  }}
                >
                  {step.label}
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="flex items-center mx-1 flex-shrink-0">
                    <div className="w-4 h-px bg-zinc-700" />
                    <svg width="8" height="8" viewBox="0 0 8 8" className="text-zinc-600">
                      <path d="M0 4h6M4 1l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile: vertical list */}
          <div className="md:hidden flex flex-col gap-2">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <div
                  className="px-3 py-2 rounded-full text-[11px] font-bold"
                  style={{
                    background: `${step.color}18`,
                    border: `1px solid ${step.color}55`,
                    color: step.color,
                  }}
                >
                  {step.label}
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <svg width="12" height="12" viewBox="0 0 12 12" className="text-zinc-600 rotate-90">
                    <path d="M6 0v10M2 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-zinc-600">
          See the math at{' '}
          <a href="/math" className="text-cyan-500 underline">
            /math
          </a>{' '}
          &middot; Back to the dashboard at{' '}
          <a href="/" className="text-cyan-500 underline">
            /
          </a>
        </div>
      </div>
    </div>
  )
}
