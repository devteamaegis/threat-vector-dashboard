'use client'

import { useEffect, useState, useCallback } from 'react'

export type Lang = 'en' | 'es'

// Every UI string that appears prominently in the dashboard. Keep keys short.
// Add a new key here and use t('key') anywhere — both languages must stay in sync.
const STRINGS: Record<string, { en: string; es: string }> = {
  // Header / nav
  'header.title':           { en: 'Kairos · Command Center',                es: 'Kairos · Centro de Mando' },
  'header.subtitle':        { en: 'Anonymous threat triage in <8 seconds',  es: 'Triaje anónimo de amenazas en <8 segundos' },
  'header.tab.live':        { en: 'Live',                                    es: 'En vivo' },
  'header.tab.heatmap':     { en: 'Heatmap',                                 es: 'Mapa de calor' },
  'header.tab.pipeline':    { en: 'Pipeline',                                es: 'Tubería' },
  'header.tab.graph':       { en: 'Graph',                                   es: 'Gráfico' },

  // Action buttons
  'action.demo':            { en: 'Run demo',                                es: 'Ejecutar demo' },
  'action.send.sms.demo':   { en: 'Simulate student SMS',                    es: 'Simular SMS de estudiante' },
  'action.submit.tip':      { en: 'Submit tip',                              es: 'Enviar denuncia' },
  'action.review':          { en: 'Review',                                  es: 'Revisar' },
  'action.resolve':         { en: 'Resolve',                                 es: 'Resolver' },
  'action.dismiss':         { en: 'Dismiss',                                 es: 'Descartar' },

  // Triage statuses
  'status.new':             { en: 'New',                                     es: 'Nuevo' },
  'status.reviewing':       { en: 'Reviewing',                               es: 'Revisando' },
  'status.resolved':        { en: 'Resolved',                                es: 'Resuelto' },
  'status.dismissed':       { en: 'Dismissed',                               es: 'Descartado' },

  // Urgency
  'urgency.critical':       { en: 'Critical',                                es: 'Crítico' },
  'urgency.high':           { en: 'High',                                    es: 'Alto' },
  'urgency.medium':         { en: 'Medium',                                  es: 'Medio' },
  'urgency.low':            { en: 'Low',                                     es: 'Bajo' },

  // Tip card / drawer
  'tip.anonymous':          { en: 'Anonymous',                               es: 'Anónimo' },
  'tip.source.call':        { en: 'Phone call',                              es: 'Llamada' },
  'tip.source.sms':         { en: 'Student SMS',                             es: 'SMS de estudiante' },
  'tip.source.email':       { en: 'Email forward',                           es: 'Reenvío de correo' },
  'tip.translated':         { en: 'Auto-translated from',                    es: 'Traducido automáticamente desde' },
  'tip.original':           { en: 'Original',                                es: 'Original' },
  'tip.summary':            { en: 'AI summary',                              es: 'Resumen IA' },
  'tip.key.facts':          { en: 'Key facts',                               es: 'Hechos clave' },
  'tip.recommended':        { en: 'Recommended action',                      es: 'Acción recomendada' },
  'tip.transcript':         { en: 'Transcript',                              es: 'Transcripción' },

  // Stats
  'stat.tips.today':        { en: 'Tips today',                              es: 'Denuncias hoy' },
  'stat.critical':          { en: 'Critical',                                es: 'Críticas' },
  'stat.triage.avg':        { en: 'Avg triage',                              es: 'Triaje promedio' },
  'stat.languages':         { en: 'Languages',                               es: 'Idiomas' },

  // Math demo
  'math.title':             { en: 'The math behind the triage',              es: 'La matemática detrás del triaje' },
  'math.lexical':           { en: 'Threat-word TF-IDF score',                es: 'Puntaje TF-IDF de palabras de amenaza' },
  'math.emotion':           { en: 'Emotion vector cosine',                   es: 'Coseno del vector de emoción' },
  'math.bayes':             { en: 'Bayesian Monte Carlo posterior',          es: 'Posterior bayesiano Monte Carlo' },
}

const STORAGE_KEY = 'kairos-lang'

export function useLang(): { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string } {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
      if (stored === 'en' || stored === 'es') setLangState(stored)
    } catch {}
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch {}
    if (typeof document !== 'undefined') document.documentElement.setAttribute('lang', l)
    // Broadcast to other listeners (other components that mount useLang independently)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kairos-lang', { detail: l }))
  }, [])

  // Listen for language changes from sibling components
  useEffect(() => {
    function onChange(e: Event) {
      const l = (e as CustomEvent<Lang>).detail
      if (l === 'en' || l === 'es') setLangState(l)
    }
    if (typeof window === 'undefined') return
    window.addEventListener('kairos-lang', onChange)
    return () => window.removeEventListener('kairos-lang', onChange)
  }, [])

  const t = useCallback((key: string): string => {
    const entry = STRINGS[key]
    if (!entry) return key
    return entry[lang]
  }, [lang])

  return { lang, setLang, t }
}

// Server-side or non-component usage:
export function translateStatic(key: string, lang: Lang): string {
  return STRINGS[key]?.[lang] ?? key
}
