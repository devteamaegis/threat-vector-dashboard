'use client'

import { useEffect, useRef } from 'react'
import type { MeshBasicMaterial, LineBasicMaterial } from 'three'

export type OrbMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'critical' | 'attendance'

interface Props { mode: OrbMode; size?: number }

export default function ClaudiaOrb({ mode, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef<OrbMode>(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  useEffect(() => {
    if (!canvasRef.current) return
    let animId: number
    let mounted = true

    async function init() {
      const THREE = await import('three')
      const canvas = canvasRef.current!
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setSize(size, size)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
      camera.position.set(0, 0, 4.5)

      const PARTICLE_COUNT = 1800
      const positions = new Float32Array(PARTICLE_COUNT * 3)
      const basePositions = new Float32Array(PARTICLE_COUNT * 3)
      const colors = new Float32Array(PARTICLE_COUNT * 3)
      const phases = new Float32Array(PARTICLE_COUNT)

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = 1.2 + (Math.random() - 0.5) * 0.6
        const x = r * Math.sin(phi) * Math.cos(theta)
        const y = r * Math.sin(phi) * Math.sin(theta)
        const z = r * Math.cos(phi)
        basePositions[i*3]=x; basePositions[i*3+1]=y; basePositions[i*3+2]=z
        positions[i*3]=x; positions[i*3+1]=y; positions[i*3+2]=z
        phases[i] = Math.random() * Math.PI * 2
        colors[i*3] = 0.05 + Math.random() * 0.1
        colors[i*3+1] = 0.55 + Math.random() * 0.35
        colors[i*3+2] = 0.85 + Math.random() * 0.15
      }

      const ptGeo = new THREE.BufferGeometry()
      ptGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      ptGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const ptMat = new THREE.PointsMaterial({
        size: 0.04, vertexColors: true, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
      const particles = new THREE.Points(ptGeo, ptMat)
      scene.add(particles)

      const MAX_LINES = 150
      const linePositions = new Float32Array(MAX_LINES * 2 * 3)
      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
      lineGeo.setDrawRange(0, 0)
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x06b6d4, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
      const lines = new THREE.LineSegments(lineGeo, lineMat)
      scene.add(lines)

      const ELECTRON_COUNT = 12
      const electronPos = new Float32Array(ELECTRON_COUNT * 3)
      const electronGeo = new THREE.BufferGeometry()
      electronGeo.setAttribute('position', new THREE.BufferAttribute(electronPos, 3))
      const electronMat = new THREE.PointsMaterial({
        size: 0.08, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
      scene.add(new THREE.Points(electronGeo, electronMat))
      const eProgress = Array.from({ length: ELECTRON_COUNT }, () => Math.random())
      const eFrom = Array.from({ length: ELECTRON_COUNT }, () => Math.floor(Math.random() * PARTICLE_COUNT))
      const eTo = Array.from({ length: ELECTRON_COUNT }, () => Math.floor(Math.random() * PARTICLE_COUNT))
      const eSpeeds = Array.from({ length: ELECTRON_COUNT }, () => 0.006 + Math.random() * 0.014)

      const ringCount = 4
      const rings: InstanceType<typeof THREE.Mesh>[] = []
      for (let i = 0; i < ringCount; i++) {
        const geo = new THREE.RingGeometry(1.25 + i * 0.22, 1.30 + i * 0.22, 64)
        const mat = new THREE.MeshBasicMaterial({
          color: i < 2 ? 0x06b6d4 : 0xef4444, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
        })
        const ring = new THREE.Mesh(geo, mat)
        ring.rotation.x = Math.PI / 2
        scene.add(ring)
        rings.push(ring)
      }

      const glowGeo = new THREE.SphereGeometry(1.15, 16, 16)
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4, transparent: true, opacity: 0.06,
        blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
      })
      const glowMesh = new THREE.Mesh(glowGeo, glowMat)
      scene.add(glowMesh)

      let t = 0
      const ringPhases = rings.map((_, i) => i * (Math.PI * 2 / ringCount))

      function updateColors(m: OrbMode) {
        const c = ptGeo.attributes.color.array as Float32Array
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          if (m === 'critical') {
            // Deep red + orange flicker
            c[i*3] = 0.85 + Math.random() * 0.15
            c[i*3+1] = 0.05 + Math.random() * 0.18
            c[i*3+2] = 0.02 + Math.random() * 0.05
          } else if (m === 'listening') {
            // Warm amber — call active
            c[i*3]=0.95; c[i*3+1]=0.5+Math.random()*0.2; c[i*3+2]=0.02
          } else if (m === 'thinking') {
            // Cool electric blue
            c[i*3]=0.05+Math.random()*0.15; c[i*3+1]=0.35+Math.random()*0.2; c[i*3+2]=1.0
          } else if (m === 'speaking') {
            // Cyan-to-violet shimmer
            const hue = (i / PARTICLE_COUNT + t * 0.06) % 1
            c[i*3]=Math.abs(Math.sin(hue*Math.PI))*0.4
            c[i*3+1]=0.55+Math.abs(Math.cos(hue*Math.PI))*0.35
            c[i*3+2]=0.9+Math.random()*0.1
          } else if (m === 'attendance') {
            // Soft emerald green — calm school admin
            c[i*3]=0.02+Math.random()*0.08
            c[i*3+1]=0.7+Math.random()*0.25
            c[i*3+2]=0.35+Math.random()*0.2
          } else {
            // Idle: default cyan
            c[i*3]=0.05+Math.random()*0.1; c[i*3+1]=0.55+Math.random()*0.35; c[i*3+2]=0.85+Math.random()*0.15
          }
        }
        ptGeo.attributes.color.needsUpdate = true
        const glowHex = m === 'critical' ? 0xef4444 : m === 'listening' ? 0xf97316
          : m === 'thinking' ? 0x3b82f6 : m === 'attendance' ? 0x22c55e : 0x06b6d4
        ;(glowMesh.material as MeshBasicMaterial).color.setHex(glowHex)
        ;(lineMat as LineBasicMaterial).color.setHex(glowHex)
      }

      let lastMode = 'idle'
      function animate() {
        if (!mounted) return
        animId = requestAnimationFrame(animate)
        const m = modeRef.current
        t += 0.016
        if (m !== lastMode) { updateColors(m); lastMode = m }

        const pos = ptGeo.attributes.position.array as Float32Array
        const isCrit = m === 'critical'
        const speedMult = isCrit ? 1.8 : m==='speaking'?1.2 : m==='thinking'?0.7 : m==='listening'?0.6 : m==='attendance'?0.3 : 0.06
        const radiusMult = isCrit ? 1.25 : m==='speaking'?1.12 : m==='listening'?0.95 : m==='attendance'?1.05 : 1.0
        const breathAmp  = isCrit ? 0.18 : m==='speaking'?0.12 : m==='listening'?0.07 : m==='attendance'?0.04 : 0.01

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const ph = phases[i]
          const breath = 1 + Math.sin(t * speedMult + ph) * breathAmp
          const vortex = (m==='speaking' || isCrit) ? t * (isCrit ? 0.28 : 0.14) : 0
          const bx=basePositions[i*3], by=basePositions[i*3+1], bz=basePositions[i*3+2]
          const cosV=Math.cos(vortex+ph*0.1), sinV=Math.sin(vortex+ph*0.1)
          pos[i*3]   = (bx*cosV - bz*sinV) * breath * radiusMult
          pos[i*3+1] = by * breath * radiusMult + Math.sin(t*0.5+ph)*0.05
          pos[i*3+2] = (bx*sinV + bz*cosV) * breath * radiusMult
        }
        ptGeo.attributes.position.needsUpdate = true
        particles.rotation.y += isCrit ? 0.004 : m==='speaking'?0.002 : m==='thinking'?0.001 : 0.00008
        particles.rotation.x += isCrit ? 0.0015 : m==='idle' ? 0.00003 : 0.0002

        const lineDist = m==='thinking'?0.55 : 0.45
        const lp = lineGeo.attributes.position.array as Float32Array
        let lineIdx = 0
        const sample = isCrit ? 100 : m==='thinking'?80 : m==='speaking'?60 : 30
        outer: for (let i = 0; i < sample; i++) {
          const ai = Math.floor(Math.random() * PARTICLE_COUNT)
          for (let j = i+1; j < sample; j++) {
            const bi = Math.floor(Math.random() * PARTICLE_COUNT)
            const dx=pos[ai*3]-pos[bi*3], dy=pos[ai*3+1]-pos[bi*3+1], dz=pos[ai*3+2]-pos[bi*3+2]
            const d = Math.sqrt(dx*dx+dy*dy+dz*dz)
            if (d < lineDist && lineIdx < MAX_LINES*2) {
              lp[lineIdx*3]=pos[ai*3]; lp[lineIdx*3+1]=pos[ai*3+1]; lp[lineIdx*3+2]=pos[ai*3+2]; lineIdx++
              lp[lineIdx*3]=pos[bi*3]; lp[lineIdx*3+1]=pos[bi*3+1]; lp[lineIdx*3+2]=pos[bi*3+2]; lineIdx++
              if (lineIdx >= MAX_LINES*2) break outer
            }
          }
        }
        lineGeo.attributes.position.needsUpdate = true
        lineGeo.setDrawRange(0, lineIdx)
        lineMat.opacity = isCrit ? 0.5 : m==='idle'?0.12 : m==='listening'?0.3 : 0.35

        const eVisible = m !== 'idle'
        electronMat.opacity = eVisible ? 0.9 : 0
        if (eVisible) {
          const ep = electronGeo.attributes.position.array as Float32Array
          for (let i = 0; i < ELECTRON_COUNT; i++) {
            eProgress[i] += eSpeeds[i] * (isCrit ? 3 : m==='speaking'?2 : 1)
            if (eProgress[i] >= 1) { eProgress[i]=0; eFrom[i]=eTo[i]; eTo[i]=Math.floor(Math.random()*PARTICLE_COUNT) }
            const p=eProgress[i], fi=eFrom[i], ti=eTo[i]
            ep[i*3]  =pos[fi*3]  +(pos[ti*3]  -pos[fi*3])  *p
            ep[i*3+1]=pos[fi*3+1]+(pos[ti*3+1]-pos[fi*3+1])*p
            ep[i*3+2]=pos[fi*3+2]+(pos[ti*3+2]-pos[fi*3+2])*p
          }
          electronGeo.attributes.position.needsUpdate = true
        }

        rings.forEach((ring, i) => {
          const active = m === 'speaking' || m === 'critical' || m === 'listening' || m === 'attendance'
          if (active) {
            const ph = ringPhases[i] + t * (isCrit ? 3.5 : m==='listening' ? 2.5 : m==='attendance' ? 1.2 : 1.8)
            const s = 1 + Math.sin(ph) * (isCrit ? 0.28 : m==='attendance' ? 0.10 : 0.15)
            ring.scale.setScalar(s)
            ;(ring.material as MeshBasicMaterial).color.setHex(isCrit ? 0xef4444 : m==='listening'?0xf97316 : m==='attendance'?0x22c55e : 0x06b6d4)
            ;(ring.material as MeshBasicMaterial).opacity = (isCrit ? 0.35 : m==='attendance'?0.12 : 0.15) + Math.sin(ph) * 0.15
          } else {
            ;(ring.material as MeshBasicMaterial).opacity = 0
          }
        })

        renderer.render(scene, camera)
      }
      animate()
    }
    init()
    return () => { mounted = false; cancelAnimationFrame(animId) }
  }, [size])

  return (
    <div className={`orb-${mode}`} style={{ display:'inline-block', lineHeight:0 }}>
      <canvas ref={canvasRef} width={size} height={size} style={{ display:'block', width:size, height:size }} />
    </div>
  )
}
