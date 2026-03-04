'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { RadarDataPoint } from '@/lib/types'

// ============================================
// Helpers
// ============================================

/** Distribute N control points on a sphere (Fibonacci) */
function fibonacciDirections(n: number): THREE.Vector3[] {
  const dirs: THREE.Vector3[] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const phi = goldenAngle * i
    dirs.push(new THREE.Vector3(r * Math.cos(phi), y, r * Math.sin(phi)).normalize())
  }
  return dirs
}

/** Gap color: vivid, saturated */
function gapColor(actual: number, expected: number): THREE.Color {
  if (expected === 0) return new THREE.Color('#a78bfa')
  const ratio = actual / expected
  if (ratio >= 1.0) return new THREE.Color('#34d399')  // emerald
  if (ratio >= 0.85) return new THREE.Color('#a3e635')  // lime
  if (ratio >= 0.7) return new THREE.Color('#facc15')  // yellow
  if (ratio >= 0.5) return new THREE.Color('#fb923c')  // orange
  return new THREE.Color('#f87171') // red
}

function gapColorHex(actual: number, expected: number): string {
  return '#' + gapColor(actual, expected).getHexString()
}

// ============================================
// Crystal Sphere — solid, transparent, colorful
// ============================================

interface CrystalSphereProps {
  data: RadarDataPoint[]
  controlDirs: THREE.Vector3[]
  baseRadius: number
  type: 'actual' | 'expected'
}

function CrystalSphere({ data, controlDirs, baseRadius, type }: CrystalSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.IcosahedronGeometry>(null)

  const scores = useMemo(() =>
    data.map(d => type === 'actual' ? d.actual : d.expected),
    [data, type]
  )
  const actualScores = useMemo(() => data.map(d => d.actual), [data])
  const expectedScores = useMemo(() => data.map(d => d.expected), [data])

  // Gaussian spread — wider for fewer points
  const sigma = useMemo(() => Math.PI / Math.max(data.length * 0.35, 2.5), [data.length])

  useEffect(() => {
    if (!geoRef.current) return
    const geo = geoRef.current
    const posAttr = geo.attributes.position
    const count = posAttr.count

    const colors = new Float32Array(count * 3)
    const tempDir = new THREE.Vector3()

    for (let i = 0; i < count; i++) {
      tempDir.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).normalize()

      // Deform radius based on score
      let totalW = 0
      let weightedScore = 0
      let wActual = 0
      let wExpected = 0

      for (let j = 0; j < controlDirs.length; j++) {
        const dot = tempDir.dot(controlDirs[j])
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
        const w = Math.exp(-(angle * angle) / (2 * sigma * sigma))
        totalW += w
        weightedScore += w * (scores[j] / 100)
        wActual += w * actualScores[j]
        wExpected += w * expectedScores[j]
      }

      const normalized = totalW > 0 ? weightedScore / totalW : 0.5
      const newR = baseRadius * (0.45 + normalized * 0.75)

      posAttr.setXYZ(i, tempDir.x * newR, tempDir.y * newR, tempDir.z * newR)

      // Vertex colors
      if (type === 'actual') {
        const localActual = totalW > 0 ? wActual / totalW : 0
        const localExpected = totalW > 0 ? wExpected / totalW : 70
        const c = gapColor(localActual, localExpected)
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      } else {
        // Expected: soft blue-violet
        const c = new THREE.Color('#a5b4fc')
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    posAttr.needsUpdate = true
    geo.computeVertexNormals()
  }, [data, controlDirs, scores, baseRadius, sigma, type, actualScores, expectedScores])

  if (type === 'expected') {
    // Expected: sphère pleine, très transparente, comme un halo/enveloppe
    return (
      <mesh ref={meshRef}>
        <icosahedronGeometry ref={geoRef} args={[baseRadius, 5]} />
        <meshPhysicalMaterial
          vertexColors
          transparent
          opacity={0.12}
          roughness={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    )
  }

  // Actual: sphère pleine, transparente colorée — effet crystal/glass
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry ref={geoRef} args={[baseRadius, 5]} />
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={0.55}
        roughness={0.1}
        metalness={0.05}
        clearcoat={1}
        clearcoatRoughness={0.05}
        transmission={0.3}
        thickness={1.5}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// ============================================
// Module markers
// ============================================

interface ModuleMarkerProps {
  point: RadarDataPoint
  direction: THREE.Vector3
  controlDirs: THREE.Vector3[]
  data: RadarDataPoint[]
  baseRadius: number
  sigma: number
  index: number
  isHovered: boolean
  onHover: (index: number | null) => void
}

function ModuleMarker({
  point, direction, controlDirs, data, baseRadius, sigma,
  index, isHovered, onHover,
}: ModuleMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const actualScores = useMemo(() => data.map(d => d.actual), [data])
  const expectedScores = useMemo(() => data.map(d => d.expected), [data])

  // Position: just outside the larger of actual/expected surface
  const markerR = useMemo(() => {
    const computeR = (scores: number[]) => {
      let totalW = 0
      let ws = 0
      for (let j = 0; j < controlDirs.length; j++) {
        const dot = direction.dot(controlDirs[j])
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
        const w = Math.exp(-(angle * angle) / (2 * sigma * sigma))
        totalW += w
        ws += w * (scores[j] / 100)
      }
      const n = totalW > 0 ? ws / totalW : 0.5
      return baseRadius * (0.45 + n * 0.75)
    }
    return Math.max(computeR(actualScores), computeR(expectedScores)) + 0.18
  }, [direction, controlDirs, actualScores, expectedScores, baseRadius, sigma])

  const position = useMemo(() => direction.clone().multiplyScalar(markerR), [direction, markerR])
  const color = useMemo(() => gapColorHex(point.actual, point.expected), [point.actual, point.expected])

  useFrame((state) => {
    if (meshRef.current) {
      const s = isHovered ? 2.2 : 1 + Math.sin(state.clock.elapsedTime * 2 + index * 0.7) * 0.12
      meshRef.current.scale.setScalar(s)
    }
  })

  const parts = point.module.split(' - ')
  const code = parts[0]?.trim() || ''
  const name = parts[1]?.trim() || parts[0]?.trim()

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerEnter={(e) => { e.stopPropagation(); onHover(index) }}
        onPointerLeave={(e) => { e.stopPropagation(); onHover(null) }}
      >
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 1 : 0.4}
          transparent
          opacity={0.9}
        />
      </mesh>

      <Html center distanceFactor={6} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
          <div
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all duration-200"
            style={{
              backgroundColor: isHovered ? color : 'rgba(255,255,255,0.95)',
              color: isHovered ? '#fff' : '#374151',
              border: `1.5px solid ${color}`,
              transform: isHovered ? 'scale(1.25) translateY(-4px)' : 'scale(1)',
            }}
          >
            {code}
          </div>

          {isHovered && (
            <div
              className="mt-2 bg-gray-900/95 text-white text-[10px] px-3 py-2.5 rounded-xl shadow-2xl border border-white/10 min-w-[180px]"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))' }}
            >
              <p className="font-semibold text-[11px] mb-2 pb-1.5 border-b border-white/10">{name}</p>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Score</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${point.actual}%`, backgroundColor: color }} />
                    </div>
                    <span className="font-bold min-w-[32px] text-right" style={{ color }}>{point.actual}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Attendu</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gray-400" style={{ width: `${point.expected}%` }} />
                    </div>
                    <span className="text-gray-300 min-w-[32px] text-right">{point.expected}%</span>
                  </div>
                </div>
                <div className="flex justify-between pt-1.5 mt-1 border-t border-white/10">
                  <span className="text-gray-400">Écart</span>
                  <span className={`font-bold ${point.actual >= point.expected ? 'text-green-400' : 'text-red-400'}`}>
                    {point.actual >= point.expected ? '+' : ''}{point.actual - point.expected}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

// ============================================
// Scene
// ============================================

function Scene({ data, colors }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string } }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const baseRadius = 2

  const controlDirs = useMemo(() => fibonacciDirections(data.length), [data.length])
  const sigma = useMemo(() => Math.PI / Math.max(data.length * 0.35, 2.5), [data.length])

  useFrame((_, delta) => {
    if (groupRef.current && hoveredIndex === null) {
      groupRef.current.rotation.y += delta * 0.06
    }
  })

  const handleHover = useCallback((idx: number | null) => setHoveredIndex(idx), [])

  return (
    <>
      {/* Rich lighting for glass effect */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-4, -3, -6]} intensity={0.4} color="#c4b5fd" />
      <directionalLight position={[0, -5, 3]} intensity={0.25} color="#fbbf24" />
      <pointLight position={[0, 0, 0]} intensity={0.3} color="#a78bfa" distance={5} />

      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={10}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
      />

      <group ref={groupRef}>
        {/* Expected: sphère pleine transparente (enveloppe) */}
        <CrystalSphere data={data} controlDirs={controlDirs} baseRadius={baseRadius} type="expected" />

        {/* Actual: sphère pleine colorée transparente (crystal) */}
        <CrystalSphere data={data} controlDirs={controlDirs} baseRadius={baseRadius} type="actual" />

        {/* Module markers */}
        {data.map((point, i) => (
          <ModuleMarker
            key={i}
            point={point}
            direction={controlDirs[i]}
            controlDirs={controlDirs}
            data={data}
            baseRadius={baseRadius}
            sigma={sigma}
            index={i}
            isHovered={hoveredIndex === i}
            onHover={handleHover}
          />
        ))}
      </group>
    </>
  )
}

// ============================================
// Exported component
// ============================================

interface SphereRadarProps {
  data: RadarDataPoint[]
  colors?: { actual: string; expected: string }
  height?: number
}

export function SphereRadar({ data, colors, height = 600 }: SphereRadarProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        Aucune donnée disponible
      </div>
    )
  }

  return (
    <div className="relative" style={{ height }}>
      <Canvas
        camera={{ position: [0, 1.5, 5.5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene data={data} colors={colors} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-5 py-2.5 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 via-yellow-400 to-red-400 opacity-70" />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Score actuel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-indigo-300/30 border border-indigo-300/50" />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Attendu</span>
        </div>
        <div className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[9px] text-gray-500">≥ Attendu</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-[9px] text-gray-500">Proche</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-[9px] text-gray-500">Insuffisant</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-3 right-3 text-[10px] text-gray-400 dark:text-gray-500 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
        Cliquer-glisser pour tourner &bull; Molette pour zoomer
      </div>
    </div>
  )
}
