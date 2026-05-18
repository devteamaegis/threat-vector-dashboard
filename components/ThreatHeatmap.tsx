'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import MapboxMap, { Layer, Marker, Source } from 'react-map-gl/mapbox'
import type { LayerProps, MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Tip } from '@/lib/supabase'
import {
  IconWeapon, IconBullying, IconDrugs, IconThreat, IconSelfHarm,
  IconVandalism, IconHarassment, IconFile, IconEye, IconGlobe,
  IconBarChart, IconShield,
} from '@/components/Icons'

const ThreatBreakdownModal = dynamic(() => import('@/components/ThreatBreakdownModal'), { ssr: false })

type TimeFilter = '24h' | '7d' | '30d' | 'all'

type ThreatPoint = {
  tip: Tip
  lat: number
  lng: number
  level: number
  probability: number
  locations: string[]
  isCallerGps: boolean  // true = real GPS from caller; false = inferred from school name
}

const LEVEL_COLOR: Record<number, string> = {
  1: '#64748b',
  2: '#3b82f6',
  3: '#f59e0b',
  4: '#f97316',
  5: '#ef4444',
}

const LOCATION_KEYWORDS = ['room', 'gym', 'cafeteria', 'parking', 'hallway', 'bathroom', 'auditorium', 'library']

const SCHOOL_COORDS: Record<string, [number, number]> = {
  'westbrook academy': [40.7127, -74.0059],
  'westview high school': [34.0522, -118.2437],
  'lincoln high school': [45.5152, -122.6784],
  'washington high school': [37.7749, -122.4194],
  'roosevelt high school': [47.6062, -122.3321],
  'central high school': [39.9526, -75.1652],
  'northview high school': [33.7490, -84.3880],
  'south ridge high school': [25.7617, -80.1918],
  'eastside high school': [40.4406, -79.9959],
  'riverside high school': [41.8781, -87.6298],
  'oak valley high school': [32.7157, -117.1611],
  'pinecrest high school': [35.2271, -80.8431],
  'lakewood high school': [39.7392, -104.9903],
  'mesa high school': [33.4152, -111.8315],
  'madison high school': [43.0731, -89.4012],
  'franklin high school': [36.1627, -86.7816],
  'jefferson high school': [30.2672, -97.7431],
  'fairview high school': [39.9612, -82.9988],
  'canyon ridge high school': [36.1699, -115.1398],
  'summit high school': [40.7608, -111.8910],
  'brookside high school': [42.3601, -71.0589],
}

function categoryIcon(category: string, size = 14) {
  const cls = 'shrink-0'
  switch (category) {
    case 'weapon': return <IconWeapon size={size} className={cls} />
    case 'bullying': return <IconBullying size={size} className={cls} />
    case 'drugs': return <IconDrugs size={size} className={cls} />
    case 'threat': return <IconThreat size={size} className={cls} />
    case 'self_harm': return <IconSelfHarm size={size} className={cls} />
    case 'vandalism': return <IconVandalism size={size} className={cls} />
    case 'harassment': return <IconHarassment size={size} className={cls} />
    default: return <IconFile size={size} className={cls} />
  }
}

function threatLevel(tip: Tip) {
  if (tip.threat_level != null) return Math.max(1, Math.min(5, Math.round(tip.threat_level)))
  if (tip.ai_triage_score != null) return Math.max(1, Math.min(5, Math.round(tip.ai_triage_score / 2)))
  const urgency = (tip.urgency || '').toLowerCase()
  if (urgency === 'critical') return 5
  if (urgency === 'high') return 4
  if (urgency === 'medium') return 3
  return 1
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function schoolLookup(name?: string | null): [number, number] | null {
  if (!name) return null
  const normalized = name.toLowerCase().trim()
  if (SCHOOL_COORDS[normalized]) return SCHOOL_COORDS[normalized]
  const hit = Object.entries(SCHOOL_COORDS).find(([school]) => normalized.includes(school) || school.includes(normalized))
  return hit?.[1] ?? null
}

function getTipCoords(tip: Tip): [number, number] | null {
  if (typeof tip.call_lat === 'number' && typeof tip.call_lng === 'number') return [tip.call_lat, tip.call_lng]
  return schoolLookup(tip.school_name)
}

function extractLocationClues(tip: Tip) {
  const chunks = [
    ...(tip.key_facts ?? []),
    tip.dispatch_brief ?? '',
    tip.location_context ?? '',
  ].filter(Boolean).map(String)

  const clues: string[] = []
  for (const chunk of chunks) {
    const lower = chunk.toLowerCase()
    if (!LOCATION_KEYWORDS.some(k => lower.includes(k))) continue
    const match = chunk.match(/((?:room\s+\w+)|(?:\w+\s+gym)|gym|cafeteria|parking\s+(?:lot\s*)?\w*|hallway|bathroom|auditorium|library)/i)
    clues.push((match?.[1] ?? chunk).trim())
  }
  return Array.from(new Set(clues)).slice(0, 4)
}

function seededUnit(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

function offsetCoord(lat: number, lng: number, seed: string, meters: number) {
  const angle = seededUnit(seed) * Math.PI * 2
  const dLat = (Math.cos(angle) * meters) / 111320
  const dLng = (Math.sin(angle) * meters) / (111320 * Math.cos(lat * Math.PI / 180))
  return [lat + dLat, lng + dLng] as [number, number]
}

function circlePolygon(lng: number, lat: number, radiusMeters = 500) {
  const coords: number[][] = []
  for (let i = 0; i <= 72; i++) {
    const angle = (i / 72) * Math.PI * 2
    const dLat = (Math.cos(angle) * radiusMeters) / 111320
    const dLng = (Math.sin(angle) * radiusMeters) / (111320 * Math.cos(lat * Math.PI / 180))
    coords.push([lng + dLng, lat + dLat])
  }
  return coords
}

function inTime(tip: Tip, filter: TimeFilter) {
  if (filter === 'all') return true
  const ms = Date.now() - new Date(tip.submitted_at ?? tip.created_at).getTime()
  const days = filter === '24h' ? 1 : filter === '7d' ? 7 : 30
  return ms <= days * 24 * 60 * 60 * 1000
}

function truncate(text: string, len = 170) {
  return text.length > len ? `${text.slice(0, len).trim()}...` : text
}

export default function ThreatHeatmap({
  tips,
  liveMode,
  onLiveModeChange,
}: {
  tips: Tip[]
  liveMode?: boolean
  onLiveModeChange?: (enabled: boolean) => void
}) {
  const mapRef = useRef<MapRef | null>(null)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d')
  const [levels, setLevels] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [layers, setLayers] = useState({ heatmap: true, points: true, rings: true, pins: true })
  const [internalLive, setInternalLive] = useState(false)
  const [selected, setSelected] = useState<ThreatPoint | null>(null)
  const [briefTip, setBriefTip] = useState<Tip | null>(null)
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  const previousIds = useRef<Set<string>>(new Set())
  const isLive = liveMode ?? internalLive
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  useEffect(() => {
    const ids = new Set(tips.map(t => t.id))
    const added = [...ids].filter(id => !previousIds.current.has(id))
    if (previousIds.current.size > 0 && added.length > 0) {
      setFreshIds(prev => new Set([...prev, ...added]))
      setTimeout(() => {
        setFreshIds(prev => {
          const next = new Set(prev)
          added.forEach(id => next.delete(id))
          return next
        })
      }, 3500)
    }
    previousIds.current = ids
  }, [tips])

  // Live geolocation tracking
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      () => {
        // Geolocation denied or unavailable — userLocation stays null, no markers render
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    )
    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  const points = useMemo<ThreatPoint[]>(() => {
    return tips
      .filter(t => inTime(t, timeFilter))
      .map(tip => {
        const isCallerGps = typeof tip.call_lat === 'number' && typeof tip.call_lng === 'number'
        const coords = getTipCoords(tip)
        if (!coords) return null
        const level = threatLevel(tip)
        if (!levels.has(level)) return null
        return {
          tip,
          lat: coords[0],
          lng: coords[1],
          level,
          probability: Math.max(0, Math.min(100, tip.bayes_probability_pct ?? level * 18)),
          locations: extractLocationClues(tip),
          isCallerGps,
        }
      })
      .filter(Boolean) as ThreatPoint[]
  }, [tips, timeFilter, levels])

  const center = useMemo(() => {
    if (points.length === 0) return { latitude: 39.5, longitude: -98.35, zoom: 3.3 }
    return {
      latitude: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
      longitude: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
      zoom: points.length === 1 ? 11 : 4,
    }
  }, [points])

  useEffect(() => {
    if (points.length === 0) {
      // Auto-center to user location when there are no threat points
      if (userLocation) {
        mapRef.current?.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 14,
          duration: 900,
          essential: true,
        })
      }
      return
    }
    mapRef.current?.flyTo({
      center: [center.longitude, center.latitude],
      zoom: center.zoom,
      duration: 900,
      essential: true,
    })
  }, [center, points.length, userLocation])

  const heatData = useMemo(() => ({
    type: 'FeatureCollection',
    features: points.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { weight: ({ 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.85, 5: 1 } as Record<number, number>)[p.level] },
    })),
  }), [points])

  const ringData = useMemo(() => ({
    type: 'FeatureCollection',
    features: points.filter(p => p.level >= 4).map(p => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [circlePolygon(p.lng, p.lat)] },
      properties: { color: p.level === 5 ? '#ef4444' : '#f97316' },
    })),
  }), [points])

  // User location accuracy circle GeoJSON
  const userAccuracyData = useMemo(() => {
    if (!userLocation) return null
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circlePolygon(userLocation.lng, userLocation.lat, Math.min(userLocation.accuracy, 500))],
        },
        properties: {},
      }],
    }
  }, [userLocation])

  // User 200m monitoring ring GeoJSON
  const userMonitoringRingData = useMemo(() => {
    if (!userLocation) return null
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circlePolygon(userLocation.lng, userLocation.lat, 200)],
        },
        properties: {},
      }],
    }
  }, [userLocation])

  // AI threat vector lines from user to high-level threat points
  const threatVectorData = useMemo(() => {
    if (!userLocation || points.length === 0) return null
    const highThreats = points.filter(p => p.level >= 4)
    if (highThreats.length === 0) return null
    return {
      type: 'FeatureCollection',
      features: highThreats.map((p) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [userLocation.lng, userLocation.lat],
            [p.lng, p.lat],
          ],
        },
        properties: { level: p.level },
      })),
    }
  }, [userLocation, points])

  const heatLayer: LayerProps = {
    id: 'threat-heat',
    type: 'heatmap',
    paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': 2,
      'heatmap-radius': 40,
      'heatmap-opacity': 0.7,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)',
        0.18, 'rgba(59,130,246,0.45)',
        0.45, 'rgba(245,158,11,0.72)',
        0.68, 'rgba(249,115,22,0.86)',
        1, 'rgba(239,68,68,0.95)',
      ],
    },
  }

  const ringLayer: LayerProps = {
    id: 'threat-rings',
    type: 'fill',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.15,
      'fill-outline-color': ['get', 'color'],
    },
  }

  const userAccuracyLayer: LayerProps = {
    id: 'user-location-accuracy-fill',
    type: 'fill',
    paint: {
      'fill-color': 'rgba(59,130,246,0.06)',
      'fill-outline-color': 'rgba(59,130,246,0.2)',
    },
  }

  const userMonitoringLayer: LayerProps = {
    id: 'user-location-ring-fill',
    type: 'fill',
    paint: {
      'fill-color': 'rgba(59,130,246,0.04)',
      'fill-outline-color': 'rgba(59,130,246,0.35)',
    },
  }

  const threatVectorLayer: LayerProps = {
    id: 'threat-vector-lines',
    type: 'line',
    paint: {
      'line-color': '#f59e0b',
      'line-opacity': 0.4,
      'line-width': 1.5,
      'line-dasharray': [4, 3],
    },
  }

  const stats = useMemo(() => {
    const bySchool = new Map<string, ThreatPoint[]>()
    points.forEach(p => {
      const school = p.tip.school_name || 'Unknown School'
      bySchool.set(school, [...(bySchool.get(school) ?? []), p])
    })
    const highest = points.reduce((m, p) => Math.max(m, p.level), 0)
    const mostActive = [...bySchool.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    const days = timeFilter === '24h' ? 1 : timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : Math.max(1, Math.ceil((Date.now() - Math.min(...points.map(p => new Date(p.tip.submitted_at ?? p.tip.created_at).getTime()), Date.now())) / 86400000))
    const density = points.length / Math.max(1, bySchool.size) / days
    const sevenDaysAgo = Date.now() - 7 * 86400000
    const hotzone = [...bySchool.entries()].find(([, schoolPoints]) =>
      schoolPoints.filter(p => p.level >= 4 && new Date(p.tip.submitted_at ?? p.tip.created_at).getTime() >= sevenDaysAgo).length >= 3
    )
    return {
      highest,
      mostActive: mostActive ? `${mostActive[0]} (${mostActive[1].length})` : 'No active school',
      density,
      hotzone: hotzone?.[0],
    }
  }, [points, timeFilter])

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const hasToken = Boolean(token && token !== 'FILL_IN')

  const toggleLive = (value: boolean) => {
    if (onLiveModeChange) onLiveModeChange(value)
    else setInternalLive(value)
  }

  return (
    <div className="relative h-full min-h-[calc(100vh-48px)] w-full overflow-hidden bg-black text-white">
      <style>{`
        @keyframes heatPulse { 0%{transform:scale(1);opacity:.9} 70%{transform:scale(2.4);opacity:0} 100%{transform:scale(2.4);opacity:0} }
        @keyframes pinDrop { from{transform:translate(-50%,-42px) scale(.72);opacity:0} to{transform:translate(-50%,-50%) scale(1);opacity:1} }
      `}</style>

      {hasToken ? (
        <MapboxMap
          ref={mapRef}
          mapboxAccessToken={token}
          initialViewState={center}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
          reuseMaps
        >
          {layers.rings && (
            <Source id="threat-ring-source" type="geojson" data={ringData as never}>
              <Layer {...ringLayer} />
            </Source>
          )}
          {layers.heatmap && (
            <Source id="threat-heat-source" type="geojson" data={heatData as never}>
              <Layer {...heatLayer} />
            </Source>
          )}

          {/* User location accuracy circle */}
          {userLocation && userAccuracyData && (
            <Source id="user-location-accuracy" type="geojson" data={userAccuracyData as never}>
              <Layer {...userAccuracyLayer} />
            </Source>
          )}

          {/* User 200m monitoring ring */}
          {userLocation && userMonitoringRingData && (
            <Source id="user-location-ring" type="geojson" data={userMonitoringRingData as never}>
              <Layer {...userMonitoringLayer} />
            </Source>
          )}

          {/* AI threat vector lines from user to high-level threats */}
          {userLocation && threatVectorData && (
            <Source id="threat-vector-source" type="geojson" data={threatVectorData as never}>
              <Layer {...threatVectorLayer} />
            </Source>
          )}

          {/* AI threat vector midpoint labels */}
          {userLocation && threatVectorData && points.filter(p => p.level >= 4).map((p, index) => {
            const midLat = (userLocation.lat + p.lat) / 2
            const midLng = (userLocation.lng + p.lng) / 2
            return (
              <Marker key={`threat-vector-label-${index}`} latitude={midLat} longitude={midLng} anchor="center">
                <div style={{
                  pointerEvents: 'none',
                  background: 'rgba(0,0,0,0.7)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 4,
                  padding: '2px 5px',
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: '#f59e0b',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  AI PREDICTED THREAT VECTOR
                </div>
              </Marker>
            )
          })}

          {/* User location pulsing dot marker */}
          {userLocation && (
            <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Pulsing ring */}
                <span style={{
                  position: 'absolute',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '2px solid rgba(59,130,246,0.5)',
                  animation: 'heatPulse 2s infinite',
                }} />
                {/* Dot */}
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'white',
                  border: '3px solid #3b82f6',
                  boxShadow: '0 0 0 4px rgba(59,130,246,0.3)',
                  zIndex: 1,
                }} />
                {/* Label */}
                <div style={{
                  position: 'absolute',
                  top: 18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  background: 'rgba(0,0,0,0.75)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: '#93c5fd',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                }}>
                  YOUR LOCATION · Monitoring Active
                </div>
              </div>
            </Marker>
          )}

          {layers.points && points.map(p => {
            const size = p.isCallerGps
              ? Math.max(14, 10 + (p.probability / 100) * 12)   // GPS dots: always visible
              : 6 + (p.probability / 100) * 16                   // Inferred: smaller
            const color = p.isCallerGps ? '#22c55e' : LEVEL_COLOR[p.level]  // Green for GPS, threat color for inferred
            return (
              <Marker key={p.tip.id} latitude={p.lat} longitude={p.lng} anchor="center">
                <button
                  onClick={() => setSelected(p)}
                  className={`relative flex items-center justify-center rounded-full shadow-[0_0_18px_rgba(0,0,0,0.85)] ${freshIds.has(p.tip.id) ? 'animate-[pinDrop_.42s_cubic-bezier(.21,1.18,.38,1)]' : ''}`}
                  style={{
                    width: size,
                    height: size,
                    background: color,
                    border: p.isCallerGps ? '2.5px solid rgba(255,255,255,0.9)' : '1.5px solid rgba(255,255,255,0.4)',
                    boxShadow: p.isCallerGps ? `0 0 14px ${color}90` : undefined,
                  }}
                  aria-label={`${p.isCallerGps ? 'Caller GPS location' : 'Threat at'} ${p.tip.school_name ?? 'unknown school'}`}
                >
                  {/* Pulse ring for high threat */}
                  {p.level >= 4 && <span className="absolute inset-0 rounded-full border" style={{ borderColor: color, animation: 'heatPulse 1.8s infinite' }} />}
                  {/* GPS indicator dot */}
                  {p.isCallerGps && (
                    <span style={{
                      position: 'absolute',
                      top: -14,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.75)',
                      border: '1px solid rgba(34,197,94,0.4)',
                      borderRadius: 3,
                      padding: '1px 4px',
                      fontSize: 7,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      color: '#86efac',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}>
                      📞 CALLER GPS
                    </span>
                  )}
                </button>
              </Marker>
            )
          })}

          {layers.pins && points.flatMap(p => p.locations.map((location, i) => {
            const [lat, lng] = offsetCoord(p.lat, p.lng, `${p.tip.id}-${i}`, 30 + seededUnit(`${p.tip.id}-${location}`) * 70)
            const urgent = p.level >= 4 || p.tip.category === 'weapon' || p.tip.escalation_risk === 'imminent'
            return (
              <Marker key={`${p.tip.id}-${location}-${i}`} latitude={lat} longitude={lng} anchor="bottom">
                <div className="group relative">
                  <div className="h-3 w-3 rotate-45 rounded-[3px] border border-white/30 shadow-lg" style={{ background: urgent ? '#ef4444' : '#f59e0b' }} />
                  <div className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-[10px] text-zinc-200 backdrop-blur-md group-hover:block">
                    {location}
                  </div>
                </div>
              </Marker>
            )
          }))}
        </MapboxMap>
      ) : (
        <div className="flex h-full min-h-[calc(100vh-48px)] items-center justify-center" style={{ background: 'rgba(6,8,13,0.99)' }}>
          <div className="max-w-md rounded-xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <IconGlobe size={28} className="mx-auto mb-3 text-red-400" />
            <div className="text-sm font-black uppercase tracking-[0.2em] text-zinc-200">Mapbox token required</div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">Set <span className="font-mono text-zinc-400">NEXT_PUBLIC_MAPBOX_TOKEN</span> to render the live GPS threat heatmap.</p>
          </div>
        </div>
      )}

      {/* Empty state — Mapbox token present but no GPS data */}
      {hasToken && points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-xl px-8 py-7 text-center" style={{ background: 'rgba(6,8,13,0.85)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)' }}>
            <svg className="mx-auto mb-3 text-zinc-600" width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            <div className="font-black uppercase tracking-[0.2em] text-zinc-400 text-[11px]">No GPS data yet</div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">Make a call to pin threats on the map</p>
          </div>
        </div>
      )}

      <aside className="absolute left-4 top-4 hidden w-72 rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-md lg:block">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
          <IconBarChart size={14} /> Threat Intel
        </div>
        {[
          ['Total threats', points.length],
          ['Highest level', stats.highest || 'None'],
          ['Most active school', stats.mostActive],
          ['Density score', stats.density.toFixed(2)],
        ].map(([label, value]) => (
          <div key={label} className="mb-3 border-b border-white/5 pb-3 last:mb-0 last:border-b-0 last:pb-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</div>
            <div className="mt-1 font-mono font-black text-sm text-zinc-100">{value}</div>
          </div>
        ))}
        {stats.hotzone && (
          <div className="mt-4 rounded-lg border border-red-500/25 bg-red-950/30 p-3">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-red-300">Hotzone</div>
            <div className="mt-1 text-xs text-red-100">{stats.hotzone}</div>
          </div>
        )}
        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-white/8">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Map Legend</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/90 shrink-0" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e80' }} />
              <span className="text-[10px] text-zinc-300">Caller GPS location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-white/40 shrink-0" style={{ background: '#ef4444' }} />
              <span className="text-[10px] text-zinc-300">Threat mentioned location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rotate-45 rounded-sm border border-white/30 shrink-0" style={{ background: '#f59e0b' }} />
              <span className="text-[10px] text-zinc-300">AI location clue (in-call)</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="absolute right-4 top-4 hidden w-80 rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-md md:block">
        <ControlPanel
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
          levels={levels}
          setLevels={setLevels}
          layers={layers}
          setLayers={setLayers}
          liveMode={isLive}
          setLiveMode={toggleLive}
          onLocateMe={() => {
            if (userLocation) {
              mapRef.current?.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 900, essential: true })
            }
          }}
          hasUserLocation={Boolean(userLocation)}
        />
      </section>

      <section className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-black/70 p-3 backdrop-blur-md md:hidden">
        <ControlPanel
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
          levels={levels}
          setLevels={setLevels}
          layers={layers}
          setLayers={setLayers}
          liveMode={isLive}
          setLiveMode={toggleLive}
          compact
          onLocateMe={() => {
            if (userLocation) {
              mapRef.current?.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 900, essential: true })
            }
          }}
          hasUserLocation={Boolean(userLocation)}
        />
      </section>

      {selected && (
        <div className="absolute left-1/2 top-20 z-20 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-white/10 bg-black/75 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-2">
            <span className="rounded-md px-2 py-1 text-[10px] font-black text-white" style={{ background: LEVEL_COLOR[selected.level] }}>L{selected.level}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{selected.tip.school_name || 'Unknown School'}</div>
              <div className="text-[10px] text-zinc-500">{timeAgo(selected.tip.submitted_at ?? selected.tip.created_at)}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white">Close</button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold capitalize text-zinc-200">
            {categoryIcon(selected.tip.category)}
            {selected.tip.category?.replace(/_/g, ' ') || 'Other'}
          </div>
          <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-zinc-400">{truncate(selected.tip.ai_summary || selected.tip.description || 'No summary available.')}</p>
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
              <span>Bayesian probability</span>
              <span className="font-mono text-zinc-200">{selected.probability.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${selected.probability}%`, background: `linear-gradient(90deg,#3b82f6,${LEVEL_COLOR[selected.level]})` }} />
            </div>
          </div>
          {selected.locations.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Location context</div>
              <div className="flex flex-wrap gap-1.5">
                {selected.locations.map(location => (
                  <span key={location} className="rounded-full border border-amber-500/20 bg-amber-950/30 px-2 py-1 text-[10px] text-amber-200">{location}</span>
                ))}
              </div>
            </div>
          )}
          {selected.tip.caller_emotion && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
              <IconShield size={13} />
              Caller emotion: <span className="font-semibold capitalize text-zinc-100">{selected.tip.caller_emotion}</span>
            </div>
          )}
          <button onClick={() => setBriefTip(selected.tip)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-100 transition-colors hover:bg-red-900/40">
            <IconEye size={13} /> View Full Brief
          </button>
        </div>
      )}

      {briefTip && (
        <ThreatBreakdownModal
          transcript={briefTip.description ?? ''}
          bayesProbPct={briefTip.bayes_probability_pct}
          bayesCiLow={briefTip.bayes_ci_low_pct}
          bayesCiHigh={briefTip.bayes_ci_high_pct}
          bayesDrivers={briefTip.bayes_top_drivers}
          threatLevel={threatLevel(briefTip)}
          callerEmotion={briefTip.caller_emotion}
          callerTone={briefTip.caller_tone}
          threeModelConsensus={briefTip.three_model_consensus}
          schoolName={briefTip.school_name}
          onClose={() => setBriefTip(null)}
        />
      )}
    </div>
  )
}

function ControlPanel({
  timeFilter,
  setTimeFilter,
  levels,
  setLevels,
  layers,
  setLayers,
  liveMode,
  setLiveMode,
  compact,
  onLocateMe,
  hasUserLocation,
}: {
  timeFilter: TimeFilter
  setTimeFilter: (value: TimeFilter) => void
  levels: Set<number>
  setLevels: (value: Set<number>) => void
  layers: { heatmap: boolean; points: boolean; rings: boolean; pins: boolean }
  setLayers: (value: { heatmap: boolean; points: boolean; rings: boolean; pins: boolean }) => void
  liveMode: boolean
  setLiveMode: (value: boolean) => void
  compact?: boolean
  onLocateMe?: () => void
  hasUserLocation?: boolean
}) {
  const toggleLevel = (level: number) => {
    const next = new Set(levels)
    if (next.has(level)) next.delete(level)
    else next.add(level)
    setLevels(next)
  }

  return (
    <div className={compact ? 'max-h-[45vh] overflow-y-auto' : ''}>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">Map Controls</div>
      <div className="mb-4">
        <div className="mb-2 text-[9px] uppercase tracking-wide text-zinc-500">Time filter</div>
        <div className="grid grid-cols-4 gap-1">
          {([
            ['24h', '24h'],
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['all', 'All'],
          ] as [TimeFilter, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTimeFilter(id)} className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors ${timeFilter === id ? 'bg-white/15 text-white' : 'bg-white/5 text-zinc-500 hover:text-zinc-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <div className="mb-2 text-[9px] uppercase tracking-wide text-zinc-500">Threat levels</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(level => (
            <button key={level} onClick={() => toggleLevel(level)} className="h-8 flex-1 rounded-md text-[11px] font-black transition-transform hover:scale-[1.03]" style={{ background: levels.has(level) ? LEVEL_COLOR[level] : 'rgba(255,255,255,0.05)', color: levels.has(level) ? '#fff' : '#71717a' }}>
              {level}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <div className="mb-2 text-[9px] uppercase tracking-wide text-zinc-500">Layers</div>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ['heatmap', 'Heatmap'],
            ['points', 'Points'],
            ['rings', 'Rings'],
            ['pins', 'Location Pins'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setLayers({ ...layers, [key]: !layers[key] })} className={`rounded-md px-2 py-2 text-[10px] font-semibold transition-colors ${layers[key] ? 'border border-cyan-400/30 bg-cyan-950/40 text-cyan-100' : 'border border-white/5 bg-white/5 text-zinc-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => setLiveMode(!liveMode)} className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${liveMode ? 'border-green-400/30 bg-green-950/35 text-green-200' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
        <span className={`h-2 w-2 rounded-full ${liveMode ? 'bg-green-400' : 'bg-zinc-600'}`} />
        Live mode
      </button>
      {onLocateMe && (
        <button
          onClick={onLocateMe}
          disabled={!hasUserLocation}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${hasUserLocation ? 'border-blue-400/30 bg-blue-950/35 text-blue-200 hover:bg-blue-900/40' : 'cursor-not-allowed border-white/5 bg-white/5 text-zinc-600'}`}
        >
          <span>&#128205;</span> Locate Me
        </button>
      )}
    </div>
  )
}
