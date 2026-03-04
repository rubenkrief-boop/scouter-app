'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { RadarDataPoint } from '@/lib/types'

/** Distribute points in 3D space based on score (higher = further from center) */
function layoutNodes(data: RadarDataPoint[]): THREE.Vector3[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  return data.map((d, i) => {
    const y = 1 - (i / Math.max(data.length - 1, 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const phi = goldenAngle * i
    const dist = 1.5 + (d.actual / 100) * 1.5
    return new THREE.Vector3(r * Math.cos(phi) * dist, y * dist, r * Math.sin(phi) * dist)
  })
}

interface StarNodeProps {
  point: RadarDataPoint
  position: THREE.Vector3
  index: number
  isHovered: boolean
  onHover: (i: number | null) => void
  themeColors: { actual: string; expected: string }
}

function StarNode({ point, position, index, isHovered, onHover, themeColors }: StarNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const color = point.moduleColor || themeColors.actual
  const size = 0.08 + (point.actual / 100) * 0.15

  useFrame((state) => {
    if (meshRef.current) {
      const s = isHovered ? 2 : 1 + Math.sin(state.clock.elapsedTime * 1.5 + index) * 0.15
      meshRef.current.scale.setScalar(s)
    }
    if (glowRef.current) {
      const gs = isHovered ? 3 : 1.5 + Math.sin(state.clock.elapsedTime + index * 0.5) * 0.3
      glowRef.current.scale.setScalar(gs)
    }
  })

  const parts = point.module.split(' - ')
  const code = parts[0]?.trim() || ''
  const name = parts[1]?.trim() || parts[0]?.trim()

  return (
    <group
      position={position}
      onPointerEnter={(e) => { e.stopPropagation(); onHover(index) }}
      onPointerLeave={(e) => { e.stopPropagation(); onHover(null) }}
    >
      {/* Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size * 2, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} />
      </mesh>

      {/* Core star */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHovered ? 1 : 0.5} />
      </mesh>

      {/* Label */}
      <Html center distanceFactor={7} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}>
          <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all"
            style={{ backgroundColor: isHovered ? color : 'rgba(0,0,0,0.6)', color: '#fff', border: `1px solid ${color}40`, transform: isHovered ? 'scale(1.2)' : 'scale(1)' }}>
            {code} <span className="font-normal opacity-70">{point.actual}%</span>
          </div>
          {isHovered && (
            <div className="mt-1.5 bg-gray-900/95 text-white text-[10px] px-3 py-2 rounded-xl shadow-2xl border border-white/10 min-w-[150px]">
              <p className="font-semibold text-[11px] mb-1.5 pb-1 border-b border-white/10">{name}</p>
              <div className="flex justify-between"><span className="text-gray-400">Score</span><span className="font-bold" style={{ color }}>{point.actual}%</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Attendu</span><span className="text-gray-300">{point.expected}%</span></div>
              <div className="flex justify-between pt-1 mt-1 border-t border-white/10">
                <span className="text-gray-400">Ecart</span>
                <span className={point.actual >= point.expected ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {point.actual >= point.expected ? '+' : ''}{point.actual - point.expected}%
                </span>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

/** Lines connecting nearest neighbors */
function Connections({ positions, themeColors }: { positions: THREE.Vector3[]; themeColors: { actual: string } }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < positions.length; i++) {
      const dists = positions.map((p, j) => ({ j, d: positions[i].distanceTo(p) })).filter(x => x.j !== i).sort((a, b) => a.d - b.d)
      for (const n of dists.slice(0, 2)) {
        if (n.j > i) { pts.push(positions[i], positions[n.j]) }
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [positions])

  return <lineSegments geometry={geo}><lineBasicMaterial color={themeColors.actual} transparent opacity={0.12} /></lineSegments>
}

function Scene({ data, colors }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string } }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const groupRef = useRef<THREE.Group>(null)

  const themeColors = useMemo(() => ({ actual: colors?.actual || '#7c3aed', expected: colors?.expected || '#9ca3af' }), [colors])
  const positions = useMemo(() => layoutNodes(data), [data])

  useFrame((_, delta) => {
    if (groupRef.current && hovered === null) groupRef.current.rotation.y += delta * 0.03
  })

  const handleHover = useCallback((i: number | null) => setHovered(i), [])

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color={themeColors.actual} distance={10} />
      <Stars radius={15} depth={30} count={800} factor={2} saturation={0.2} fade speed={0.5} />
      <OrbitControls enablePan={false} minDistance={4} maxDistance={12} enableDamping dampingFactor={0.05} rotateSpeed={0.5} />

      <group ref={groupRef}>
        <Connections positions={positions} themeColors={themeColors} />
        {data.map((point, i) => (
          <StarNode key={i} point={point} position={positions[i]} index={i}
            isHovered={hovered === i} onHover={handleHover} themeColors={themeColors} />
        ))}
      </group>
    </>
  )
}

export function ConstellationRadar({ data, colors, height = 600 }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string }; height?: number }) {
  if (data.length === 0) return <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>Aucune donnee disponible</div>
  return (
    <div className="relative" style={{ height }}>
      <Canvas camera={{ position: [0, 1, 6], fov: 50 }} style={{ background: '#0f172a' }} gl={{ antialias: true }}>
        <Scene data={data} colors={colors} />
      </Canvas>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-gray-900/90 backdrop-blur-sm rounded-full px-5 py-2 shadow-lg border border-gray-700">
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: colors?.actual || '#7c3aed' }} /><span className="text-[10px] font-medium text-gray-300">Niveau actuel (taille)</span></div>
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border border-gray-500" /><span className="text-[10px] font-medium text-gray-300">Attendu</span></div>
      </div>
      <div className="absolute top-3 right-3 text-[10px] text-gray-500 bg-gray-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5">Cliquer-glisser pour tourner &bull; Molette pour zoomer</div>
    </div>
  )
}
