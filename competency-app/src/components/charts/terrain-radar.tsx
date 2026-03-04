'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { RadarDataPoint } from '@/lib/types'

/** Compute terrain height at a given (x,z) based on nearby module control points */
function terrainHeight(
  x: number, z: number,
  controlPts: { x: number; z: number; score: number }[],
  sigma: number
): number {
  let totalW = 0
  let wScore = 0
  for (const cp of controlPts) {
    const dx = x - cp.x
    const dz = z - cp.z
    const dist2 = dx * dx + dz * dz
    const w = Math.exp(-dist2 / (2 * sigma * sigma))
    totalW += w
    wScore += w * cp.score
  }
  return totalW > 0 ? wScore / totalW : 0
}

interface TerrainMeshProps {
  data: RadarDataPoint[]
  type: 'actual' | 'expected'
  themeColors: { actual: string; expected: string }
}

function TerrainMesh({ data, type, themeColors }: TerrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.PlaneGeometry>(null)
  const gridSize = 3
  const segments = 60
  const maxHeight = 2.5
  const sigma = 1.2

  // Place modules on a circle
  const controlPts = useMemo(() =>
    data.map((d, i) => {
      const angle = (i / data.length) * Math.PI * 2
      const r = gridSize * 0.7
      return {
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        score: (type === 'actual' ? d.actual : d.expected) / 100,
      }
    }),
    [data, type, gridSize]
  )

  useEffect(() => {
    if (!geoRef.current) return
    const geo = geoRef.current
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const baseColor = new THREE.Color(type === 'actual' ? themeColors.actual : themeColors.expected)

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = terrainHeight(x, z, controlPts, sigma) * maxHeight
      pos.setY(i, h)

      // Vertex color: intensity based on height
      const t = h / maxHeight
      const c = baseColor.clone().multiplyScalar(0.3 + t * 0.9)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    pos.needsUpdate = true
    geo.computeVertexNormals()
  }, [controlPts, maxHeight, sigma, themeColors, type])

  if (type === 'expected') {
    return (
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry ref={geoRef} args={[gridSize * 2, gridSize * 2, segments, segments]} />
        <meshPhysicalMaterial vertexColors transparent opacity={0.15} wireframe side={THREE.DoubleSide} />
      </mesh>
    )
  }

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry ref={geoRef} args={[gridSize * 2, gridSize * 2, segments, segments]} />
      <meshPhysicalMaterial vertexColors transparent opacity={0.8} roughness={0.3} clearcoat={0.6} side={THREE.DoubleSide} />
    </mesh>
  )
}

interface MarkerProps {
  point: RadarDataPoint
  angle: number
  radius: number
  maxHeight: number
  index: number
  isHovered: boolean
  onHover: (i: number | null) => void
  themeColors: { actual: string; expected: string }
}

function Marker({ point, angle, radius, maxHeight, index, isHovered, onHover, themeColors }: MarkerProps) {
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius
  const y = (point.actual / 100) * maxHeight + 0.15
  const color = point.moduleColor || themeColors.actual
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((s) => {
    if (meshRef.current) {
      const sc = isHovered ? 1.8 : 1 + Math.sin(s.clock.elapsedTime * 2 + index) * 0.1
      meshRef.current.scale.setScalar(sc)
    }
  })

  const parts = point.module.split(' - ')
  const code = parts[0]?.trim() || ''
  const name = parts[1]?.trim() || parts[0]?.trim()

  return (
    <group
      position={[x, y, z]}
      onPointerEnter={(e) => { e.stopPropagation(); onHover(index) }}
      onPointerLeave={(e) => { e.stopPropagation(); onHover(null) }}
    >
      {/* Pin line */}
      <mesh position={[0, -(y - 0.05) / 2, 0]}>
        <cylinderGeometry args={[0.01, 0.01, y - 0.05, 4]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      <mesh ref={meshRef}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHovered ? 0.8 : 0.3} />
      </mesh>

      <Html center distanceFactor={6} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
          <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: isHovered ? color : 'rgba(255,255,255,0.9)', color: isHovered ? '#fff' : '#374151', border: `1.5px solid ${color}`, transition: 'all 0.2s' }}>
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

function Scene({ data, colors }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string } }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const maxHeight = 2.5
  const radius = 3 * 0.7

  const themeColors = useMemo(() => ({ actual: colors?.actual || '#7c3aed', expected: colors?.expected || '#9ca3af' }), [colors])

  useFrame((_, delta) => {
    if (groupRef.current && hovered === null) groupRef.current.rotation.y += delta * 0.04
  })

  const handleHover = useCallback((i: number | null) => setHovered(i), [])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 3]} intensity={0.6} />
      <directionalLight position={[-4, 3, -5]} intensity={0.2} color={themeColors.actual} />
      <OrbitControls enablePan={false} minDistance={4} maxDistance={12} enableDamping dampingFactor={0.05} rotateSpeed={0.5} maxPolarAngle={Math.PI / 2.2} />

      <group ref={groupRef}>
        {/* Expected terrain (wireframe) */}
        <TerrainMesh data={data} type="expected" themeColors={themeColors} />
        {/* Actual terrain (solid) */}
        <TerrainMesh data={data} type="actual" themeColors={themeColors} />
        {/* Module markers */}
        {data.map((point, i) => (
          <Marker key={i} point={point} angle={(i / data.length) * Math.PI * 2} radius={radius}
            maxHeight={maxHeight} index={i} isHovered={hovered === i} onHover={handleHover} themeColors={themeColors} />
        ))}
      </group>
    </>
  )
}

export function TerrainRadar({ data, colors, height = 600 }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string }; height?: number }) {
  if (data.length === 0) return <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>Aucune donnee disponible</div>
  return (
    <div className="relative" style={{ height }}>
      <Canvas camera={{ position: [0, 4, 6], fov: 45 }} style={{ background: 'transparent' }} gl={{ antialias: true, alpha: true }}>
        <Scene data={data} colors={colors} />
      </Canvas>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-5 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-sm" style={{ backgroundColor: colors?.actual || '#7c3aed' }} /><span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Score (relief)</span></div>
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-sm border-2 border-dashed" style={{ borderColor: colors?.expected || '#9ca3af' }} /><span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Attendu (fil de fer)</span></div>
      </div>
      <div className="absolute top-3 right-3 text-[10px] text-gray-400 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5">Cliquer-glisser pour tourner &bull; Molette pour zoomer</div>
    </div>
  )
}
