'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import type { Tip } from '@/lib/supabase'

const ThreatHeatmap = dynamic(() => import('@/components/ThreatHeatmap'), { ssr: false })

function getTipHasGps(tip: Tip) {
  return typeof tip.call_lat === 'number' && typeof tip.call_lng === 'number'
}

export default function HeatmapPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [liveMode, setLiveMode] = useState(true)  // always-on by default
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initial load + fast Supabase-realtime-style polling
  useEffect(() => {
    let cancelled = false

    const load = () => {
      fetch('/api/tips')
        .then(r => r.json())
        .then(data => {
          if (!cancelled) setTips(Array.isArray(data) ? data : [])
        })
        .catch(() => {})
    }

    load()

    // Always poll every 6 s so new geocoded tips (mentioned_lat/lng included)
    // appear on the map as soon as the backend writes them
    pollRef.current = setInterval(load, 6000)

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])  // run once — polling is unconditional

  const gpsCount = tips.filter(getTipHasGps).length

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: 'rgba(6,8,13,0.99)' }}>
      {/* Heatmap page header */}
      <header className="shrink-0 flex items-center justify-between px-5 h-11"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,8,13,0.97)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Dashboard</span>
          </a>
          <span className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <svg className="text-red-400" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-200">GPS Threat Heatmap</span>
          </div>
          {gpsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded font-mono font-black text-[9px] text-red-300"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}>
              {gpsCount}
            </span>
          )}
        </div>
        {/* Live indicator — always shown since polling is always on */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Live</span>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <ThreatHeatmap tips={tips} liveMode={liveMode} onLiveModeChange={setLiveMode} />
      </div>
    </main>
  )
}
