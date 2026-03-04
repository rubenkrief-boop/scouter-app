'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
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

/** Color for the gap actual vs expected */
function gapColor(actual: number, expected: number): THREE.Color {
  if (expected === 0) return new THREE.Color('#8b5cf6')
  const ratio = actual / expected
  if (ratio >= 1.0) return new THREE.Color('#22c55e') // green
  if (ratio >= 0.8) return new THREE.Color('#eab308') // yellow
  if (ratio >= 0.5) return new THREE.Color('#f97316') // orange
  return new THREE.Color('#ef4444') // red
}

function gapColorHex(actual: number, expected: number): string {
  return '#' + gapColor(actual, expected).getHexString()
}

/** Compute deformed radius for a given vertex direction based on data control points */
function computeDeformedRadius(
  vertexDir: THREE.Vector3,
  controlDirs: THREE.Vector3[],
  scores: number[],
  baseRadius: number,
  sigma: number,
): number {
  let totalW = 0
  let weightedScore = 0

  for (let j = 0; j < controlDirs.length; j++) {
    const dot = vertexDir.dot(controlDirs[j])
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    const w = Math.exp(-(angle * angle) / (2 * sigma * sigma))
    totalW += w
    weightedScore += w * (scores[j] / 100)
  }

  const normalized = totalW > 0 ? weightedScore / totalW : 0.5
  // Map 0..1 to 0.5..1.2 of baseRadius (more range for visibility)
  return baseRadius * (0.5 + normalized * 0.7)
}

// ============================================
// Deformed solid mesh with vertex colors
// ============================================

interface SolidShellProps {
  data: RadarDataPoint[]
  controlDirs: THREE.Vector3[]
  baseRadius: number
  type: 'actual' | 'expected'
}

function SolidShell({ data, controlDirs, baseRadius, type }: SolidShellProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.IcosahedronGeometry>(null)

  const scores = useMemo(() =>
    data.map(d => type === 'actual' ? d.actual : d.expected),
    [data, type]
  )

  const expectedScores = useMemo(() => data.map(d => d.expected), [data])
  const actualScores = useMemo(() => data.map(d => d.actual), [data])

  // Wider influence for fewer control points
  const sigma = useMemo(() => Math.PI / Math.max(data.length * 0.35, 2.5), [data.length])

  // Deform geometry + apply vertex colors
  useEffect(() => {
    if (!geoRef.current) return
    const geo = geoRef.current
    const posAttr = geo.attributes.position
    const count = posAttr.count

    // Add vertex colors
    const colors = new Float32Array(count * 3)
    const tempDir = new THREE.Vector3()

    for (let i = 0; i < count; i++) {
      tempDir.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).normalize()

      const newR = computeDeformedRadius(tempDir, controlDirs, scores, baseRadius, sigma)

      posAttr.setXYZ(i, tempDir.x * newR, tempDir.y * newR, tempDir.z * newR)

      // Vertex colors for actual mesh: colored by gap
      if (type === 'actual') {
        // Compute local actual and expected for this vertex
        let totalW = 0
        let wActual = 0
        let wExpected = 0
        for (let j = 0; j < controlDirs.length; j++) {
          const dot = tempDir.dot(controlDirs[j])
          const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
          const w = Math.exp(-(angle * angle) / (2 * sigma * sigma))
          totalW += w
          wActual += w * actualScores[j]
          wExpected += w * expectedScores[j]
        }
        const localActual = totalW > 0 ? wActual / totalW : 0
        const localExpected = totalW > 0 ? wExpected / totalW : 70
        const c = gapColor(localActual, localExpected)
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      } else {
        // Expected: uniform gray-purple
        colors[i * 3] = 0.6
        colors[i * 3 + 1] = 0.6
        colors[i * 3 + 2] = 0.7
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    posAttr.needsUpdate = true
    geo.computeVertexNormals()
  }, [data, controlDirs, scores, baseRadius, sigma, type, actualScores, expectedScores])

  if (type === 'expected') {
    return (
      <mesh ref={meshRef}>
        <icosahedronGeometry ref={geoRef} args={[baseRadius, 5]} />
        <meshPhysicalMaterial
          vertexColors
          transparent
          opacity={0.1}
          wireframe
          wireframeLinewidth={1}
          side={THREE.DoubleSide}
        />
      </mesh>
    )
  }

  // Actual: solid colored mesh
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry ref={geoRef} args={[baseRadius, 5]} />
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={0.75}
        roughness={0.25}
        metalness={0.05}
        clearcoat={1}
        clearcoatRoughness={0.15}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

// ============================================
// Module markers (labels at control points)
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
  index, isHovered, onHover
}: ModuleMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  const actualScores = useMemo(() => data.map(d => d.actual), [data])
  const expectedScores = useMemo(() => data.map(d => d.expected), [data])

  // Position at the actual surface + slight offset outward
  const actualR = useMemo(() =>
    computeDeformedRadius(direction, controlDirs, actualScores, baseRadius, sigma),
    [direction, controlDirs, actualScores, baseRadius, sigma]
  )
  const expectedR = useMemo(() =>
    computeDeformedRadius(direction, controlDirs, expectedScores, baseRadius, sigma),
    [direction, controlDirs, expectedScores, baseRadius, sigma]
  )

  const markerR = Math.max(actualR, expectedR) + 0.12
  const position = useMemo(() => direction.clone().multiplyScalar(markerR), [direction, markerR])

  const color = useMemo(() => gapColorHex(point.actual, point.expected), [point.actual, point.expected])

  // Pulse
  useFrame((state) => {
    if (meshRef.current) {
      const s = isHovered ? 2 : 1 + Math.sin(state.clock.elapsedTime * 2 + index * 0.7) * 0.15
      meshRef.current.scale.setScalar(s)
    }
  })

  const parts = point.module.split(' - ')
  const code = parts[0]?.trim() || ''
  const name = parts[1]?.trim() || parts[0]?.trim()

  return (
    <group position={position}>
      {/* Dot at surface */}
      <mesh
        ref={meshRef}
        onPointerEnter={(e) => { e.stopPropagation(); onHover(index) }}
        onPointerLeave={(e) => { e.stopPropagation(); onHover(null) }}
      >
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.8 : 0.3}
        />
      </mesh>

      {/* Code badge */}
      <Html
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
          <div
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all duration-200"
            style={{
              backgroundColor: isHovered ? color : 'rgba(255,255,255,0.92)',
              color: isHovered ? '#fff' : '#374151',
              border: `1.5px solid ${color}`,
              transform: isHovered ? 'scale(1.2) translateY(-4px)' : 'scale(1)',
            }}
          >
            {code}
          </div>

          {/* Tooltip on hover */}
          {isHovered && (
            <div
              className="mt-2 bg-gray-900/95 text-white text-[10px] px-3 py-2.5 rounded-xl shadow-2xl border border-white/10 min-w-[170px]"
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
                  <span className="text-gray-400">Ecart</span>
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

  // Auto-rotation, pause on hover
  useFrame((_, delta) => {
    if (groupRef.current && hoveredIndex === null) {
      groupRef.current.rotation.y += delta * 0.06
    }
  })

  const handleHover = useCallback((idx: number | null) => setHoveredIndex(idx), [])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={0.6} />
      <directionalLight position={[-4, -2, -6]} intensity={0.2} color="#c4b5fd" />
      <pointLight position={[0, 0, 0]} intensity={0.15} color="#7c3aed" distance={6} />

      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={10}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
      />

      <group ref={groupRef}>
        {/* Outer shell: EXPECTED (wireframe, translucent) */}
        <SolidShell data={data} controlDirs={controlDirs} baseRadius={baseRadius} type="expected" />

        {/* Inner solid: ACTUAL (opaque, vertex-colored by gap) */}
        <SolidShell data={data} controlDirs={controlDirs} baseRadius={baseRadius} type="actual" />

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
        Aucune donnee disponible
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-5 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-green-400 via-yellow-400 to-red-400 opacity-80" />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Score (solide)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm border-2 border-gray-400 border-dashed opacity-50" />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Attendu (fil de fer)</span>
        </div>
        <div className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[9px] text-gray-500">&ge; Attendu</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-[9px] text-gray-500">Proche</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
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
