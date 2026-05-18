'use client'

import { useLang } from '@/lib/i18n'

export default function LanguageToggle() {
  const { lang, setLang } = useLang()
  return (
    <div className="inline-flex items-center rounded-full p-0.5 border"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
      <button onClick={() => setLang('en')}
        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
          lang === 'en' ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'
        }`}
        aria-pressed={lang === 'en'}>
        EN
      </button>
      <button onClick={() => setLang('es')}
        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
          lang === 'es' ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'
        }`}
        aria-pressed={lang === 'es'}>
        ES
      </button>
    </div>
  )
}
