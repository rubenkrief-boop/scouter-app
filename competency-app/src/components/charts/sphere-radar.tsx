'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { RadarDataPoint } from '@/lib/types'

// ============================================
// Helpers
// ============================================

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

function gapColor(actual: number, expected: number): THREE.Color {
  if (expected === 0) return new THREE.Color('#a78bfa')
  const ratio = actual / expected
  if (ratio >= 1.0) return new THREE.Color('#34d399')
  if (ratio >= 0.85) return new THREE.Color('#a3e635')
  if (ratio >= 0.7) return new THREE.Color('#facc15')
  if (ratio >= 0.5) return new THREE.Color('#fb923c')
  return new THREE.Color('#f87171')
}

function gapColorHex(actual: number, expected: number): string {
  return '#' + gapColor(actual, expected).getHexString()
}

/** Deform vertex for the expected outer shell (kept from previous version) */
function deformVertex(
  dir: THREE.Vector3,
  controlDirs: THREE.Vector3[],
  scores: number[],
  baseRadius: number,
): { radius: number; moduleIdx: number } {
  let best = -2, second = -2
  let bestIdx = 0, secondIdx = 0
  for (let j = 0; j < controlDirs.length; j++) {
    const d = dir.dot(controlDirs[j])
    if (d > best) {
      second = best; secondIdx = bestIdx
      best = d; bestIdx = j
    } else if (d > second) {
      second = d; secondIdx = j
    }
  }

  const bestScore = scores[bestIdx] / 100
  const secondScore = scores[secondIdx] / 100

  const gap = best - second
  const blendZone = 0.08
  const t = gap > blendZone ? 1 : gap / blendZone
  const score = bestScore * t + secondScore * (1 - t)
  const r = baseRadius * (0.4 + score * 0.75)

  return { radius: r, moduleIdx: bestIdx }
}

// ============================================
// OUTER: Expected Shell (transparent — user approved ✓)
// ============================================

interface ExpectedShellProps {
  data: RadarDataPoint[]
  controlDirs: THREE.Vector3[]
  baseRadius: number
  hoveredIdx: number | null
}

function ExpectedShell({ data, controlDirs, baseRadius, hoveredIdx }: ExpectedShellProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.IcosahedronGeometry>(null)

  const scores = useMemo(() => data.map(d => d.expected), [data])

  useEffect(() => {
    if (!geoRef.current) return
    const geo = geoRef.current
    const posAttr = geo.attributes.position
    const count = posAttr.count
    const vertColors = new Float32Array(count * 3)
    const tempDir = new THREE.Vector3()

    for (let i = 0; i < count; i++) {
      tempDir.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).normalize()
      const { radius, moduleIdx } = deformVertex(tempDir, controlDirs, scores, baseRadius)
      posAttr.setXYZ(i, tempDir.x * radius, tempDir.y * radius, tempDir.z * radius)

      const isHov = hoveredIdx === moduleIdx
      vertColors[i * 3] = isHov ? 0.75 : 0.7
      vertColors[i * 3 + 1] = isHov ? 0.72 : 0.68
      vertColors[i * 3 + 2] = isHov ? 0.95 : 0.88
    }

    geo.setAttribute('color', new THREE.BufferAttribute(vertColors, 3))
    posAttr.needsUpdate = true
    geo.computeVertexNormals()
  }, [data, controlDirs, scores, baseRadius, hoveredIdx])

  return (
    <group>
      <mesh ref={meshRef}>
        <icosahedronGeometry ref={geoRef} args={[baseRadius, 3]} />
        <meshPhysicalMaterial
          vertexColors
          transparent
          opacity={0.12}
          roughness={0.05}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[baseRadius, 3]} />
        <meshBasicMaterial color="#a5b4fc" transparent opacity={0.18} wireframe />
      </mesh>
    </group>
  )
}

// ============================================
// INNER: Crystal Spike (one per module)
// ============================================

interface CrystalSpikeProps {
  point: RadarDataPoint
  direction: THREE.Vector3
  maxLength: number
  index: number
  isHovered: boolean
  onHover: (index: number | null) => void
}

function CrystalSpike({ point, direction, maxLength, index, isHovered, onHover }: CrystalSpikeProps) {
  const groupRef = useRef<THREE.Group>(null)

  const color = useMemo(() => gapColorHex(point.actual, point.expected), [point.actual, point.expected])
  const colorObj = useMemo(() => gapColor(point.actual, point.expected), [point.actual, point.expected])

  // Spike length proportional to actual score
  const spikeLength = (point.actual / 100) * maxLength
  // Base width — tapers to a point
  const baseWidth = 0.12 + (point.actual / 100) * 0.06

  // Orientation: align Y axis of cone along direction
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    return q
  }, [direction])

  // Position: cone centered at half its length along direction
  const position = useMemo(
    () => direction.clone().multiplyScalar(spikeLength / 2),
    [direction, spikeLength]
  )

  // Subtle pulse
  useFrame((state) => {
    if (groupRef.current) {
      const pulse = isHovered ? 1.08 : 1 + Math.sin(state.clock.elapsedTime * 1.5 + index * 0.9) * 0.02
      groupRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group ref={groupRef}>
      {/* Main crystal spike — faceted cone (5 sides = pentagonal crystal) */}
      <mesh
        position={position}
        quaternion={quaternion}
        onPointerEnter={(e) => { e.stopPropagation(); onHover(index) }}
        onPointerLeave={(e) => { e.stopPropagation(); onHover(null) }}
      >
        <coneGeometry args={[baseWidth, spikeLength, 5, 1]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.5 : 0.15}
          transparent
          opacity={isHovered ? 0.88 : 0.75}
          roughness={0.08}
          metalness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.05}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Secondary smaller crystal alongside (for natural crystal cluster look) */}
      <mesh
        position={direction.clone().multiplyScalar(spikeLength * 0.35).add(
          new THREE.Vector3(direction.y, -direction.x, direction.z).normalize().multiplyScalar(0.08)
        )}
        quaternion={quaternion}
      >
        <coneGeometry args={[baseWidth * 0.5, spikeLength * 0.55, 4, 1]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.4 : 0.1}
          transparent
          opacity={isHovered ? 0.75 : 0.6}
          roughness={0.1}
          metalness={0.1}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Tip glow */}
      <mesh position={direction.clone().multiplyScalar(spikeLength)}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 1.5 : 0.6}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  )
}

// ============================================
// Core glow (center of the crystal formation)
// ============================================

function CoreGlow() {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.15
      ref.current.scale.setScalar(s)
    }
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.18, 16, 16]} />
      <meshStandardMaterial
        color="#c4b5fd"
        emissive="#8b5cf6"
        emissiveIntensity={0.8}
        transparent
        opacity={0.5}
      />
    </mesh>
  )
}

// ============================================
// Module markers (labels)
// ============================================

interface ModuleMarkerProps {
  point: RadarDataPoint
  direction: THREE.Vector3
  outerRadius: number
  index: number
  isHovered: boolean
  onHover: (index: number | null) => void
}

function ModuleMarker({ point, direction, outerRadius, index, isHovered, onHover }: ModuleMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  const position = useMemo(
    () => direction.clone().multiplyScalar(outerRadius + 0.35),
    [direction, outerRadius]
  )
  const color = useMemo(() => gapColorHex(point.actual, point.expected), [point.actual, point.expected])

  useFrame((state) => {
    if (meshRef.current) {
      const s = isHovered ? 2.5 : 1 + Math.sin(state.clock.elapsedTime * 2 + index * 0.7) * 0.1
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
  const baseRadius = 2.2

  const controlDirs = useMemo(() => fibonacciDirections(data.length), [data.length])

  useFrame((_, delta) => {
    if (groupRef.current && hoveredIndex === null) {
      groupRef.current.rotation.y += delta * 0.05
    }
  })

  const handleHover = useCallback((idx: number | null) => setHoveredIndex(idx), [])

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 8, 5]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-5, -3, -5]} intensity={0.35} color="#ddd6fe" />
      <directionalLight position={[2, -6, 4]} intensity={0.2} color="#fde68a" />
      <pointLight position={[0, 0, 0]} intensity={0.3} color="#c4b5fd" distance={5} />

      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={10}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
      />

      <group ref={groupRef}>
        {/* OUTER: Expected shell — transparent glass (approved ✓) */}
        <ExpectedShell
          data={data}
          controlDirs={controlDirs}
          baseRadius={baseRadius}
          hoveredIdx={hoveredIndex}
        />

        {/* CENTER: Core glow */}
        <CoreGlow />

        {/* INNER: Crystal spikes — one per module */}
        {data.map((point, i) => (
          <CrystalSpike
            key={`spike-${i}`}
            point={point}
            direction={controlDirs[i]}
            maxLength={baseRadius * 0.88}
            index={i}
            isHovered={hoveredIndex === i}
            onHover={handleHover}
          />
        ))}

        {/* Module markers (labels outside) */}
        {data.map((point, i) => (
          <ModuleMarker
            key={`marker-${i}`}
            point={point}
            direction={controlDirs[i]}
            outerRadius={baseRadius * 1.15}
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
        camera={{ position: [0, 1.5, 6], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene data={data} colors={colors} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-5 py-2.5 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-indigo-300/60 bg-indigo-200/15" />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Attendu (enveloppe)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-4 bg-gradient-to-t from-emerald-400 to-emerald-200 opacity-80" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Score (cristaux)</span>
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

      <div className="absolute top-3 right-3 text-[10px] text-gray-400 dark:text-gray-500 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
        Cliquer-glisser pour tourner &bull; Molette pour zoomer
      </div>
    </div>
  )
}
