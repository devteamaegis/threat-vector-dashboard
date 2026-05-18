import { NextRequest, NextResponse } from 'next/server'

// Lightweight translation route.
//   POST { text, source?: 'auto'|'es'|'fr'|..., target: 'en'|'es' }
//
// Tries Gemini first (if GEMINI_API_KEY is set), then falls back to the public
// Google Translate widget endpoint so the demo still works without a key.

export async function POST(req: NextRequest) {
  const { text, source = 'auto', target = 'en' } = await req.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }

  // 1️⃣  Gemini path — preferred when key present
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Translate the following text into ${target === 'es' ? 'Spanish' : 'English'}. Return only the translation, nothing else.\n\n${text}` }] }],
          }),
        }
      )
      if (r.ok) {
        const data = await r.json()
        const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (translated) return NextResponse.json({ translated, source: 'gemini' })
      }
    } catch {
      // fall through to public fallback
    }
  }

  // 2️⃣  Public translate fallback — no key, demo-quality
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) throw new Error(`status ${r.status}`)
    const data = await r.json()
    // Response shape: [[[translatedChunk, originalChunk, null, null], ...], ...]
    const translated = Array.isArray(data?.[0]) ? data[0].map((c: unknown[]) => c[0]).join('') : ''
    if (translated) return NextResponse.json({ translated, source: 'public' })
    return NextResponse.json({ error: 'Empty translation' }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ error: 'Translation failed', detail: String(err) }, { status: 502 })
  }
}
