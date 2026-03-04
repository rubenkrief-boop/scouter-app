'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
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
function gapColorHex(actual: number, expected: number): string {
  if (expected === 0) return '#8b5cf6'
  const ratio = actual / expected
  if (ratio >= 1.0) return '#22c55e' // green
  if (ratio >= 0.8) return '#eab308' // yellow
  if (ratio >= 0.5) return '#f97316' // orange
  return '#ef4444' // red
}

/** Lerp hex color */
function lerpColor(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a)
  const cb = new THREE.Color(b)
  ca.lerp(cb, t)
  return '#' + ca.getHexString()
}

// ============================================
// Reference Sphere (wireframe grid)
// ============================================

function ReferenceSphere({ radius, color }: { radius: number; color: string }) {
  return (
    <group>
      {/* Very subtle wireframe sphere for spatial reference */}
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.04}
          wireframe
        />
      </mesh>
      {/* Slight solid inner for glow effect */}
      <mesh>
        <sphereGeometry args={[radius * 0.15, 16, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.15}
          emissive={color}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

// ============================================
// Radial Bar (spike) for each module
// ============================================

interface RadialBarProps {
  point: RadarDataPoint
  direction: THREE.Vector3
  maxRadius: number
  index: number
  isHovered: boolean
  onHover: (index: number | null) => void
  themeColors: { actual: string; expected: string }
}

function RadialBar({
  point, direction, maxRadius, index, isHovered, onHover, themeColors
}: RadialBarProps) {
  const barRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  // Compute bar geometry
  const actualLength = (point.actual / 100) * maxRadius
  const expectedLength = (point.expected / 100) * maxRadius
  const barThickness = 0.06

  // Gap-based color
  const barColor = useMemo(() => {
    const gap = gapColorHex(point.actual, point.expected)
    // Blend with theme actual color
    return lerpColor(gap, themeColors.actual, 0.3)
  }, [point.actual, point.expected, themeColors.actual])

  // Orientation: align cylinder along direction
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    return q
  }, [direction])

  // Bar center position (cylinder is centered, so offset by half length)
  const actualCenter = useMemo(
    () => direction.clone().multiplyScalar(actualLength / 2),
    [direction, actualLength]
  )

  const expectedCenter = useMemo(
    () => direction.clone().multiplyScalar(expectedLength / 2),
    [direction, expectedLength]
  )

  // Label position (tip of the longer bar + offset)
  const labelPos = useMemo(() => {
    const tipR = Math.max(actualLength, expectedLength) + 0.25
    return direction.clone().multiplyScalar(tipR)
  }, [direction, actualLength, expectedLength])

  // Expected ring position (at the expected height along the direction)
  const expectedRingPos = useMemo(
    () => direction.clone().multiplyScalar(expectedLength),
    [direction, expectedLength]
  )

  // Pulse animation
  useFrame((state) => {
    if (glowRef.current) {
      const pulse = isHovered
        ? 1.8
        : 1 + Math.sin(state.clock.elapsedTime * 2 + index * 0.5) * 0.15
      glowRef.current.scale.setScalar(pulse)
    }
  })

  // Parse module name
  const parts = point.module.split(' - ')
  const code = parts[0]?.trim() || ''
  const name = parts[1]?.trim() || parts[0]?.trim()

  return (
    <group ref={barRef}>
      {/* === Actual score bar (solid, rounded) === */}
      <mesh
        position={actualCenter}
        quaternion={quaternion}
        onPointerEnter={(e) => { e.stopPropagation(); onHover(index) }}
        onPointerLeave={(e) => { e.stopPropagation(); onHover(null) }}
      >
        <cylinderGeometry args={[
          isHovered ? barThickness * 1.5 : barThickness,
          isHovered ? barThickness * 1.8 : barThickness * 1.2,
          actualLength,
          8,
          1
        ]} />
        <meshPhysicalMaterial
          color={barColor}
          emissive={barColor}
          emissiveIntensity={isHovered ? 0.6 : 0.2}
          transparent
          opacity={isHovered ? 0.95 : 0.85}
          roughness={0.3}
          metalness={0.1}
          clearcoat={0.8}
        />
      </mesh>

      {/* === Expected level: translucent outer cylinder === */}
      <mesh
        position={expectedCenter}
        quaternion={quaternion}
      >
        <cylinderGeometry args={[
          barThickness * 2.5,
          barThickness * 2.5,
          expectedLength,
          8,
          1
        ]} />
        <meshBasicMaterial
          color={themeColors.expected}
          transparent
          opacity={isHovered ? 0.15 : 0.07}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* === Expected ring marker (torus at the expected height) === */}
      <mesh
        position={expectedRingPos}
        quaternion={quaternion}
      >
        <torusGeometry args={[barThickness * 3, 0.015, 8, 24]} />
        <meshStandardMaterial
          color={themeColors.expected}
          emissive={themeColors.expected}
          emissiveIntensity={0.3}
          transparent
          opacity={isHovered ? 0.9 : 0.5}
        />
      </mesh>

      {/* === Tip glow dot === */}
      <mesh
        ref={glowRef}
        position={direction.clone().multiplyScalar(actualLength)}
      >
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial
          color={barColor}
          emissive={barColor}
          emissiveIntensity={isHovered ? 1.2 : 0.5}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* === Base anchor point (small sphere at origin along direction) === */}
      <mesh position={direction.clone().multiplyScalar(0.05)}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial
          color={barColor}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* === Module label === */}
      <Html
        position={labelPos}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
          <div
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all duration-200"
            style={{
              backgroundColor: isHovered ? barColor : 'rgba(255,255,255,0.92)',
              color: isHovered ? '#fff' : '#374151',
              border: `1.5px solid ${barColor}`,
              transform: isHovered ? 'scale(1.3) translateY(-4px)' : 'scale(1)',
            }}
          >
            {code}
          </div>

          {/* Tooltip on hover */}
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
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${point.actual}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <span className="font-bold min-w-[32px] text-right" style={{ color: barColor }}>
                      {point.actual}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Attendu</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gray-400"
                        style={{ width: `${point.expected}%` }}
                      />
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
// Connection Lines (from center to bar tips)
// ============================================

function ConnectionLine({
  direction, actualLength, color
}: {
  direction: THREE.Vector3; actualLength: number; color: string
}) {
  const points = useMemo(() => [
    new THREE.Vector3(0, 0, 0),
    direction.clone().multiplyScalar(actualLength)
  ], [direction, actualLength])

  return (
    <Line
      points={points}
      color={color}
      lineWidth={0.5}
      transparent
      opacity={0.12}
    />
  )
}

// ============================================
// Scene
// ============================================

function Scene({ data, colors }: { data: RadarDataPoint[]; colors?: { actual: string; expected: string } }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const maxRadius = 2.5

  // Resolve theme colors with defaults
  const themeColors = useMemo(() => ({
    actual: colors?.actual || '#7c3aed',
    expected: colors?.expected || '#9ca3af',
  }), [colors])

  const controlDirs = useMemo(() => fibonacciDirections(data.length), [data.length])

  // Auto-rotation, pause on hover
  useFrame((_, delta) => {
    if (groupRef.current && hoveredIndex === null) {
      groupRef.current.rotation.y += delta * 0.08
    }
  })

  const handleHover = useCallback((idx: number | null) => setHoveredIndex(idx), [])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.7} />
      <directionalLight position={[-4, -2, -6]} intensity={0.25} color="#c4b5fd" />
      <pointLight position={[0, 0, 0]} intensity={0.3} color={themeColors.actual} distance={8} />

      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={12}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
      />

      <group ref={groupRef}>
        {/* Reference sphere (subtle wireframe grid) */}
        <ReferenceSphere radius={maxRadius} color={themeColors.expected} />

        {/* Connection lines from center to tips */}
        {data.map((point, i) => (
          <ConnectionLine
            key={`line-${i}`}
            direction={controlDirs[i]}
            actualLength={(point.actual / 100) * maxRadius}
            color={themeColors.actual}
          />
        ))}

        {/* Radial bars (spikes) for each module */}
        {data.map((point, i) => (
          <RadialBar
            key={i}
            point={point}
            direction={controlDirs[i]}
            maxRadius={maxRadius}
            index={i}
            isHovered={hoveredIndex === i}
            onHover={handleHover}
            themeColors={themeColors}
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
        camera={{ position: [0, 2, 6], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene data={data} colors={colors} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-5 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-4 rounded-full" style={{ backgroundColor: colors?.actual || '#7c3aed' }} />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Niveau actuel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-dashed" style={{ borderColor: colors?.expected || '#9ca3af' }} />
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">Attendu</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-gray-200 dark:border-gray-700">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[9px] text-gray-500 dark:text-gray-400">≥ Attendu</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[9px] text-gray-500 dark:text-gray-400">&lt; Attendu</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-3 right-3 text-[10px] text-gray-400 dark:text-gray-500 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
        Cliquer-glisser pour tourner &bull; Molette pour zoomer
      </div>
    </div>
  )
}
