export const metadata = { title: 'Kairos — Use Case' }

const SCENARIOS = [
  {
    icon: '📞',
    title: 'Anonymous voice hotline',
    line: 'A student dials the Kairos number from any phone, in any language.',
    body: 'AgentPhone picks up, transcribes the call in real time, and POSTs the transcript to the Kairos webhook. Gemini Live auto-detects the language and translates. The student never gives their name and never appears on a caller ID. The line is staffed by an AI agent 24/7 — no human gatekeeping, no fear of judgement, no waiting for a counsellor to call back.',
  },
  {
    icon: '💬',
    title: 'Student text-in number',
    line: 'A student walks into a hallway and sees a fight starting. They text a number.',
    body: 'The dashboard exposes a single inbound SMS endpoint (/api/inbound-tip) that AgentPhone, Twilio, or any provider can POST to. The text is run through the same Bayesian Monte Carlo pipeline as a voice tip: lexical scoring, emotion analysis, model consensus. A triaged tip lands on the dashboard in under 8 seconds and the principal gets paged.',
  },
  {
    icon: '✉️',
    title: 'Teacher email forward',
    line: 'A teacher receives a worrying email from a student and forwards it to safety@kairos.school.',
    body: 'AgentMail accepts the forward, parses the message body, and POSTs it to the same /api/inbound-tip endpoint with source="email". The forwarded thread becomes an immutable record on the dashboard, complete with sender masking, and the AI brief reaches the safety officer\'s inbox within seconds.',
  },
  {
    icon: '🏫',
    title: 'Cross-district central database',
    line: 'A pattern that\'s invisible to any one school becomes obvious across the district.',
    body: 'Every tip from every channel flows into the same Supabase table. Supermemory builds long-term semantic memory of patterns per school. When a tip arrives at Westbrook, the AI can recall that Westbrook had two prior weapon tips this semester — context no individual counsellor could hold. District superintendents get the macro view; principals get the micro.',
  },
  {
    icon: '📲',
    title: 'Phone-app push to school resource officer',
    line: 'For Level 4+ threats, the dashboard pages the SRO directly.',
    body: 'A native push (or Twilio SMS for now) lands on the SRO\'s phone with the threat level, school name, dominant emotion, and one-line recommended action. The same brief lands in AgentMail for the district safety officer. The SRO can mark the tip "reviewing" from their phone — that status syncs to the dashboard via Supabase realtime in under a second.',
  },
]

function Scenario({ s, idx }: { s: typeof SCENARIOS[number]; idx: number }) {
  return (
    <div className="relative pl-14 pb-10">
      <div className="absolute left-0 top-0 w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {s.icon}
      </div>
      {idx !== SCENARIOS.length - 1 && (
        <div className="absolute left-5 top-10 bottom-0 w-px" style={{ background: 'var(--border)' }} />
      )}
      <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-500 mb-1">Scenario {idx + 1}</div>
      <h3 className="text-xl font-black mb-2">{s.title}</h3>
      <p className="text-base text-zinc-400 italic mb-3">{s.line}</p>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground-2)' }}>{s.body}</p>
    </div>
  )
}

export default function UseCasePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-3xl mx-auto px-8 py-16">
        <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-500 mb-2">Kairos · Sample Implementation</div>
        <h1 className="text-4xl font-black mb-4">One number. One inbox. One database.</h1>
        <p className="text-lg leading-relaxed mb-12" style={{ color: 'var(--foreground-2)' }}>
          Kairos is not a single product — it is the central database for every threat signal a school district generates.
          Voice calls, student SMS, teacher email forwards, and (soon) native phone-app pushes all flow into the same
          Supabase table and the same Bayesian Monte Carlo triage. Below is what that looks like in practice.
        </p>

        {SCENARIOS.map((s, i) => <Scenario key={i} s={s} idx={i} />)}

        {/* Walkthrough */}
        <div className="mt-12 p-6 rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-red-500 font-bold mb-3">Worked scenario · 11:42 AM Tuesday</div>
          <h2 className="text-2xl font-black mb-4">A fight in the cafeteria</h2>
          <ol className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--foreground-2)' }}>
            <li><span className="font-mono text-cyan-500">+0.0s</span> — A junior at Westbrook Academy texts the Kairos number: <i>"There is a fight starting in the cafeteria right now. Multiple kids. One of them has a knife. Please hurry, we are scared."</i></li>
            <li><span className="font-mono text-cyan-500">+0.3s</span> — Gemini Live detects English; lexical scorer hits <code>fight</code>, <code>knife</code>, <code>scared</code> (weights 1.8, 2.8, 1.5).</li>
            <li><span className="font-mono text-cyan-500">+2.4s</span> — Claude classifies Level 4; Gemini independently classifies Level 4. Consensus locks in.</li>
            <li><span className="font-mono text-cyan-500">+2.5s</span> — Bayesian Monte Carlo: posterior μ = 4.12, 95% CI [3.6, 4.6], P(escalation) = 81%.</li>
            <li><span className="font-mono text-cyan-500">+3.4s</span> — Tip lands on the dashboard. Principal's phone vibrates.</li>
            <li><span className="font-mono text-cyan-500">+4.6s</span> — Twilio SMS to the SRO with the brief. SRO is moving toward the cafeteria.</li>
            <li><span className="font-mono text-cyan-500">+5.2s</span> — AgentMail emails the district safety officer with the full transcript, Bayesian posterior, and recommended action.</li>
            <li><span className="font-mono text-cyan-500">+5.8s</span> — Supermemory stores the memory: "Westbrook · weapon · Level 4." Future tips at Westbrook will be enriched with this context automatically.</li>
          </ol>
          <p className="mt-5 text-sm" style={{ color: 'var(--foreground-2)' }}>
            <b>Same flow.</b> A phone call from a parent, a forwarded email from a teacher, an anonymous SMS from a friend.
            Different inputs, identical pipeline, identical math.
          </p>
        </div>

        <div className="mt-10 text-center text-xs" style={{ color: 'var(--muted)' }}>
          See the math at <a href="/math" className="text-cyan-500 underline">/math</a> · Back to the dashboard at <a href="/" className="text-cyan-500 underline">/</a>
        </div>
      </div>
    </div>
  )
}
