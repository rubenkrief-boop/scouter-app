'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { RadarDataPoint } from '@/lib/types'

function gapColorHex(actual: number, expected: number): string {
  if (expected === 0) return '#8b5cf6'
  const ratio = actual / expected
  if (ratio >= 1.0) return '#22c55e'
  if (ratio >= 0.8) return '#eab308'
  if (ratio >= 0.5) return '#f97316'
  return '#ef4444'
}

/** Circular platform base */
function Platform({ radius }: { radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <cylinderGeometry args={[radius, radius, 0.08, 64]} />
      <meshPhysicalMaterial color="#f1f5f9" roughness={0.8} metalness={0} />
    </mesh>
  )
}

/** Grid lines on the platform */
function GridLines({ radius, maxHeight }: { radius: number; maxHeight: number }) {
  const lines = useMemo(() => {
    const pts: THREE.Vector3[] = []
    // Concentric circles at 25%, 50%, 75%, 100%
    for (const pct of [0.25, 0.5, 0.75, 1.0]) {
      const h = pct * maxHeight
      const segs = 48
      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2
        const a2 = ((i + 1) / segs) * Math.PI * 2
        const r = radius * 0.9
        pts.push(new THREE.Vector3(Math.cos(a1) * r, h, Math.sin(a1) * r))
        pts.push(new THREE.Vector3(Math.cos(a2) * r, h, Math.sin(a2) * r))
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [radius, maxHeight])

  return (
    <lineSegments geometry={lines}>
      <lineBasicMaterial color="#e2e8f0" transparent opacity={0.4} />
    </lineSegments>
  )
}

interface BarProps {
  point: RadarDataPoint
  angle: number
  distance: number
  maxHeight: number
  index: number
  isHovered: boolean
  onHover: (i: number | null) => void
  themeColors: { actual: string; expected: string }
}

function Bar({ point, angle, distance, maxHeight, index, isHovered, onHover, themeColors }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const actualH = (point.actual / 100) * maxHeight
  const expectedH = (point.expected / 100) * maxHeight
  const barWidth = 0.25
  const color = point.moduleColor || themeColors.actual

  const x = Math.cos(angle) * distance
  const z = Math.sin(angle) * distance

  useFrame(() => {
    if (meshRef.current) {
      const s = isHovered ? 1.15 : 1
      meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, s, 0.1)
      meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, s, 0.1)
    }
  })

  const parts = point.module.split(' - ')
  const code = parts[0]?.trim() || ''
  const name = parts[1]?.trim() || parts[0]?.trim()

  return (
    <group
      position={[x, 0, z]}
      onPointerEnter={(e) => { e.stopPropagation(); onHover(index) }}
      onPointerLeave={(e) => { e.stopPropagation(); onHover(null) }}
    >
      {/* Actual bar */}
      <mesh ref={meshRef} position={[0, actualH / 2, 0]}>
        <boxGeometry args={[barWidth, actualH, barWidth]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.3 : 0.08}
          roughness={0.3}
          clearcoat={0.6}
        />
      </mesh>

      {/* Expected marker (thin ring) */}
      {point.expected > 0 && (
        <mesh position={[0, expectedH, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[barWidth * 0.7, barWidth * 1.1, 4]} />
          <meshBasicMaterial color={themeColors.expected} transparent opacity={isHovered ? 0.8 : 0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Code label */}
      <Html position={[0, -0.25, 0]} center distanceFactor={7} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          className="text-[8px] font-bold px-1 py-0.5 rounded"
          style={{
            backgroundColor: isHovered ? color : 'rgba(255,255,255,0.9)',
            color: isHovered ? '#fff' : '#374151',
            border: `1px solid ${color}`,
            transition: 'all 0.2s',
          }}
        >
          {code}
        </div>
      </Html>

      {/* Hover tooltip */}
      {isHovered && (
        <Html position={[0, actualH + 0.3, 0]} center distanceFactor={6} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-gray-900/95 text-white text-[10px] px-3 py-2 rounded-xl shadow-2xl border border-white/10 min-w-[150px]">
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
        </Html>
      )}
    </group>
  )
}

function Scene({ data, colors }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string } }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const maxHeight = 3
  const platformRadius = 2.5

  const themeColors = useMemo(() => ({
    actual: colors?.actual || '#7c3aed',
    expected: colors?.expected || '#9ca3af',
  }), [colors])

  useFrame((_, delta) => {
    if (groupRef.current && hovered === null) {
      groupRef.current.rotation.y += delta * 0.05
    }
  })

  const handleHover = useCallback((i: number | null) => setHovered(i), [])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 3]} intensity={0.7} />
      <directionalLight position={[-3, 4, -5]} intensity={0.2} color={themeColors.actual} />
      <OrbitControls enablePan={false} minDistance={4} maxDistance={12} dampingFactor={0.05} enableDamping rotateSpeed={0.5} maxPolarAngle={Math.PI / 2.1} />

      <group ref={groupRef}>
        <Platform radius={platformRadius} />
        <GridLines radius={platformRadius} maxHeight={maxHeight} />

        {data.map((point, i) => {
          const angle = (i / data.length) * Math.PI * 2 - Math.PI / 2
          return (
            <Bar key={i} point={point} angle={angle} distance={platformRadius * 0.7} maxHeight={maxHeight}
              index={i} isHovered={hovered === i} onHover={handleHover} themeColors={themeColors} />
          )
        })}
      </group>
    </>
  )
}

export function SkylineRadar({ data, colors, height = 600 }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string }; height?: number }) {
  if (data.length === 0) return <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>Aucune donnee disponible</div>

  return (
    <div className="relative" style={{ height }}>
      <Canvas camera={{ position: [0, 4, 6], fov: 45 }} style={{ background: 'transparent' }} gl={{ antialias: true, alpha: true }}>
        <Scene data={data} colors={colors} />
      </Canvas>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-5 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-3 rounded-sm" style={{ backgroundColor: colors?.actual || '#7c3aed' }} />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Niveau actuel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-3 rounded-sm border-2 border-dashed" style={{ borderColor: colors?.expected || '#9ca3af' }} />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Attendu</span>
        </div>
      </div>
      <div className="absolute top-3 right-3 text-[10px] text-gray-400 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
        Cliquer-glisser pour tourner &bull; Molette pour zoomer
      </div>
    </div>
  )
}
