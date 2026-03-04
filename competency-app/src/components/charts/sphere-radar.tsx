'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { RadarDataPoint } from '@/lib/types'

// ============================================
// Helpers
// ============================================

/** Distribute N directions evenly on a sphere (Fibonacci spiral) */
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

/** Gap color — vivid, saturated */
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

/** Find nearest module index for a given direction on the sphere */
function nearestModule(dir: THREE.Vector3, controlDirs: THREE.Vector3[]): { idx: number; secondIdx: number; edgeFactor: number } {
  let bestDot = -2
  let secondDot = -2
  let idx = 0
  let secondIdx = 0
  for (let j = 0; j < controlDirs.length; j++) {
    const d = dir.dot(controlDirs[j])
    if (d > bestDot) {
      secondDot = bestDot
      secondIdx = idx
      bestDot = d
      idx = j
    } else if (d > secondDot) {
      secondDot = d
      secondIdx = j
    }
  }
  // edgeFactor: 0 = deep inside zone, 1 = exactly on border
  const diff = bestDot - secondDot
  const edgeFactor = Math.max(0, 1 - diff * 8)
  return { idx, secondIdx, edgeFactor }
}

// ============================================
// Voronoi Globe — perfect sphere, colored zones
// ============================================

interface VoronoiGlobeProps {
  data: RadarDataPoint[]
  controlDirs: THREE.Vector3[]
  radius: number
  hoveredIdx: number | null
}

function VoronoiGlobe({ data, controlDirs, radius, hoveredIdx }: VoronoiGlobeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.IcosahedronGeometry>(null)

  useEffect(() => {
    if (!geoRef.current) return
    const geo = geoRef.current
    const posAttr = geo.attributes.position
    const count = posAttr.count

    const colors = new Float32Array(count * 3)
    const tempDir = new THREE.Vector3()

    for (let i = 0; i < count; i++) {
      tempDir.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).normalize()

      const { idx, edgeFactor } = nearestModule(tempDir, controlDirs)
      const point = data[idx]
      const zoneColor = gapColor(point.actual, point.expected)

      // Darken at zone boundaries for clear separation
      const borderDarkening = 1 - edgeFactor * 0.7

      // Brighten hovered zone
      const hoverBoost = hoveredIdx === idx ? 1.2 : 1.0

      colors[i * 3] = Math.min(1, zoneColor.r * borderDarkening * hoverBoost)
      colors[i * 3 + 1] = Math.min(1, zoneColor.g * borderDarkening * hoverBoost)
      colors[i * 3 + 2] = Math.min(1, zoneColor.b * borderDarkening * hoverBoost)
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.attributes.color.needsUpdate = true
  }, [data, controlDirs, hoveredIdx])

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry ref={geoRef} args={[radius, 6]} />
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={0.65}
        roughness={0.05}
        metalness={0.0}
        clearcoat={1}
        clearcoatRoughness={0.05}
        transmission={0.15}
        thickness={2}
        side={THREE.FrontSide}
        envMapIntensity={1}
      />
    </mesh>
  )
}

// ============================================
// Inner reference sphere (expected level)
// ============================================

function ExpectedGlobe({ data, controlDirs, radius }: {
  data: RadarDataPoint[]
  controlDirs: THREE.Vector3[]
  radius: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.IcosahedronGeometry>(null)

  useEffect(() => {
    if (!geoRef.current) return
    const geo = geoRef.current
    const posAttr = geo.attributes.position
    const count = posAttr.count
    const tempDir = new THREE.Vector3()

    // Deform inner sphere slightly per module's expected score
    for (let i = 0; i < count; i++) {
      tempDir.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).normalize()
      const { idx } = nearestModule(tempDir, controlDirs)
      const expectedRatio = data[idx].expected / 100
      const r = radius * (0.3 + expectedRatio * 0.7)
      posAttr.setXYZ(i, tempDir.x * r, tempDir.y * r, tempDir.z * r)
    }

    posAttr.needsUpdate = true
    geo.computeVertexNormals()
  }, [data, controlDirs, radius])

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry ref={geoRef} args={[radius, 5]} />
      <meshPhysicalMaterial
        color="#a5b4fc"
        transparent
        opacity={0.08}
        wireframe
        wireframeLinewidth={1}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// ============================================
// Atmosphere glow (outer shell)
// ============================================

function AtmosphereGlow({ radius }: { radius: number }) {
  return (
    <mesh>
      <sphereGeometry args={[radius * 1.02, 48, 48]} />
      <meshBasicMaterial
        color="#c4b5fd"
        transparent
        opacity={0.04}
        side={THREE.BackSide}
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
  radius: number
  index: number
  isHovered: boolean
  onHover: (index: number | null) => void
}

function ModuleMarker({ point, direction, radius, index, isHovered, onHover }: ModuleMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  const position = useMemo(
    () => direction.clone().multiplyScalar(radius + 0.2),
    [direction, radius]
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
  const radius = 2.2

  const controlDirs = useMemo(() => fibonacciDirections(data.length), [data.length])

  useFrame((_, delta) => {
    if (groupRef.current && hoveredIndex === null) {
      groupRef.current.rotation.y += delta * 0.05
    }
  })

  const handleHover = useCallback((idx: number | null) => setHoveredIndex(idx), [])

  return (
    <>
      {/* Lighting for glass/crystal look */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 8, 5]} intensity={1} color="#ffffff" />
      <directionalLight position={[-5, -3, -5]} intensity={0.4} color="#ddd6fe" />
      <directionalLight position={[0, -6, 4]} intensity={0.3} color="#fde68a" />
      <pointLight position={[0, 0, 0]} intensity={0.2} color="#c4b5fd" distance={4} />

      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={10}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
      />

      <group ref={groupRef}>
        {/* Atmosphere glow */}
        <AtmosphereGlow radius={radius} />

        {/* Main globe: perfect sphere, colored zones */}
        <VoronoiGlobe data={data} controlDirs={controlDirs} radius={radius} hoveredIdx={hoveredIndex} />

        {/* Inner expected reference (subtle wireframe) */}
        <ExpectedGlobe data={data} controlDirs={controlDirs} radius={radius * 0.95} />

        {/* Module markers */}
        {data.map((point, i) => (
          <ModuleMarker
            key={i}
            point={point}
            direction={controlDirs[i]}
            radius={radius}
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
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Score par zone</span>
        </div>
        <div className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] text-gray-500">≥ Attendu</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-lime-400" />
          <span className="text-[9px] text-gray-500">Proche</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="text-[9px] text-gray-500">En progrès</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
          <span className="text-[9px] text-gray-500">À travailler</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="text-[9px] text-gray-500">Insuffisant</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-3 right-3 text-[10px] text-gray-400 dark:text-gray-500 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
        Cliquer-glisser pour tourner &bull; Molette pour zoomer &bull; Survoler une zone
      </div>
    </div>
  )
}
