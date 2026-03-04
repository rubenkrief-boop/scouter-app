'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { RadarDataPoint } from '@/lib/types'

/** Create a petal shape */
function createPetalShape(width: number, length: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(width * 0.6, length * 0.2, width * 0.5, length * 0.7, 0, length)
  s.bezierCurveTo(-width * 0.5, length * 0.7, -width * 0.6, length * 0.2, 0, 0)
  return s
}

interface PetalProps {
  point: RadarDataPoint
  angle: number
  index: number
  isHovered: boolean
  onHover: (i: number | null) => void
  themeColors: { actual: string; expected: string }
  maxLength: number
}

function Petal({ point, angle, index, isHovered, onHover, themeColors, maxLength }: PetalProps) {
  const groupRef = useRef<THREE.Group>(null)
  const actualLen = (point.actual / 100) * maxLength
  const expectedLen = (point.expected / 100) * maxLength
  const color = point.moduleColor || themeColors.actual

  // Petal geometry
  const actualGeo = useMemo(() => {
    const shape = createPetalShape(0.25, actualLen)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 })
    return geo
  }, [actualLen])

  const expectedGeo = useMemo(() => {
    const shape = createPetalShape(0.3, expectedLen)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false })
    return geo
  }, [expectedLen])

  useFrame(() => {
    if (groupRef.current) {
      const targetTilt = isHovered ? 0.15 : 0
      groupRef.current.children.forEach(c => {
        if (c instanceof THREE.Mesh) {
          // slight bounce
        }
      })
    }
  })

  const parts = point.module.split(' - ')
  const code = parts[0]?.trim() || ''
  const name = parts[1]?.trim() || parts[0]?.trim()

  return (
    <group
      ref={groupRef}
      rotation={[0, angle, 0]}
      onPointerEnter={(e) => { e.stopPropagation(); onHover(index) }}
      onPointerLeave={(e) => { e.stopPropagation(); onHover(null) }}
    >
      {/* Actual petal (solid, thick) */}
      <mesh geometry={actualGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.3 : 0.05}
          transparent
          opacity={0.85}
          roughness={0.3}
          clearcoat={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Expected petal outline */}
      {point.expected > 0 && (
        <mesh geometry={expectedGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <meshBasicMaterial
            color={themeColors.expected}
            transparent
            opacity={0.2}
            wireframe
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Label at tip */}
      <Html
        position={[0, 0.1, actualLen + 0.2]}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
          <div
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{
              backgroundColor: isHovered ? color : 'rgba(255,255,255,0.92)',
              color: isHovered ? '#fff' : '#374151',
              border: `1.5px solid ${color}`,
              transition: 'all 0.2s',
            }}
          >
            {code}
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

/** Central pistil */
function Pistil({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((s) => { if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.2 })
  return (
    <mesh ref={ref}>
      <dodecahedronGeometry args={[0.2, 0]} />
      <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.2} clearcoat={1} />
    </mesh>
  )
}

function Scene({ data, colors }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string } }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const maxLength = 2.5

  const themeColors = useMemo(() => ({
    actual: colors?.actual || '#7c3aed',
    expected: colors?.expected || '#9ca3af',
  }), [colors])

  useFrame((_, delta) => {
    if (groupRef.current && hovered === null) groupRef.current.rotation.y += delta * 0.04
  })

  const handleHover = useCallback((i: number | null) => setHovered(i), [])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 3]} intensity={0.6} />
      <directionalLight position={[-4, 3, -5]} intensity={0.2} color={themeColors.actual} />
      <OrbitControls enablePan={false} minDistance={3} maxDistance={10} enableDamping dampingFactor={0.05} rotateSpeed={0.5} />

      <group ref={groupRef}>
        <Pistil color={themeColors.actual} />
        {data.map((point, i) => (
          <Petal key={i} point={point} angle={(i / data.length) * Math.PI * 2} index={i}
            isHovered={hovered === i} onHover={handleHover} themeColors={themeColors} maxLength={maxLength} />
        ))}
      </group>
    </>
  )
}

export function FlowerRadar({ data, colors, height = 600 }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string }; height?: number }) {
  if (data.length === 0) return <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>Aucune donnee disponible</div>
  return (
    <div className="relative" style={{ height }}>
      <Canvas camera={{ position: [0, 3, 5], fov: 45 }} style={{ background: 'transparent' }} gl={{ antialias: true, alpha: true }}>
        <Scene data={data} colors={colors} />
      </Canvas>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-5 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-sm" style={{ backgroundColor: colors?.actual || '#7c3aed' }} /><span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Niveau actuel</span></div>
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-sm border-2 border-dashed" style={{ borderColor: colors?.expected || '#9ca3af' }} /><span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Attendu</span></div>
      </div>
      <div className="absolute top-3 right-3 text-[10px] text-gray-400 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5">Cliquer-glisser pour tourner &bull; Molette pour zoomer</div>
    </div>
  )
}
