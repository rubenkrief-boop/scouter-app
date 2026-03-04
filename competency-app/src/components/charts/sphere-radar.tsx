'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Float } from '@react-three/drei'
import * as THREE from 'three'
import type { RadarDataPoint } from '@/lib/types'

// ============================================
// Helpers
// ============================================

/** Distribute N points on a sphere using Fibonacci spiral (golden angle) */
function fibonacciSphere(n: number): [number, number][] {
  const points: [number, number][] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    // theta: polar angle (0 to PI), phi: azimuthal (0 to 2PI)
    const y = 1 - (i / (n - 1)) * 2 // y goes from 1 to -1
    const radius = Math.sqrt(1 - y * y)
    const phi = goldenAngle * i
    const theta = Math.acos(y)
    points.push([theta, phi])
  }
  return points
}

/** Lerp between two colors based on t (0-1) */
function lerpColor(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a)
  const cb = new THREE.Color(b)
  ca.lerp(cb, t)
  return '#' + ca.getHexString()
}

/** Get color based on gap: green if above expected, red if below */
function gapColor(actual: number, expected: number): string {
  if (expected === 0) return '#6366f1'
  const ratio = actual / expected
  if (ratio >= 1) return lerpColor('#22c55e', '#15803d', Math.min((ratio - 1) * 2, 1))
  if (ratio >= 0.7) return lerpColor('#eab308', '#22c55e', (ratio - 0.7) / 0.3)
  return lerpColor('#ef4444', '#eab308', ratio / 0.7)
}

// ============================================
// Deformed sphere mesh
// ============================================

interface DeformedSphereProps {
  data: RadarDataPoint[]
  positions: [number, number][]
  baseRadius: number
  type: 'actual' | 'expected'
  colors?: { actual: string; expected: string }
}

function DeformedSphere({ data, positions, baseRadius, type, colors }: DeformedSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.SphereGeometry>(null)

  const actualColor = colors?.actual || '#7c3aed'
  const expectedColor = colors?.expected || '#9ca3af'

  // Deform geometry based on data scores
  useMemo(() => {
    if (!geoRef.current) return
    const geo = geoRef.current
    const posAttr = geo.attributes.position
    const count = posAttr.count

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i)
      const y = posAttr.getY(i)
      const z = posAttr.getZ(i)

      // Convert vertex to spherical coords
      const r = Math.sqrt(x * x + y * y + z * z)
      if (r === 0) continue
      const theta = Math.acos(y / r)
      const phi = Math.atan2(z, x)

      // Find influence from each data point
      let totalWeight = 0
      let weightedScore = 0

      for (let j = 0; j < data.length; j++) {
        const [pTheta, pPhi] = positions[j]
        // Angular distance on sphere
        const cosD = Math.sin(theta) * Math.sin(pTheta) * Math.cos(phi - pPhi) +
                     Math.cos(theta) * Math.cos(pTheta)
        const dist = Math.acos(Math.max(-1, Math.min(1, cosD)))

        // Gaussian influence — wider spread for fewer points
        const sigma = Math.PI / Math.max(data.length * 0.4, 3)
        const w = Math.exp(-(dist * dist) / (2 * sigma * sigma))
        totalWeight += w

        const score = type === 'actual' ? data[j].actual : data[j].expected
        weightedScore += w * (score / 100)
      }

      const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5
      // Deform: score 0 = 60% radius, score 100 = 120% radius
      const deform = 0.6 + normalizedScore * 0.6
      const newR = baseRadius * deform

      posAttr.setXYZ(
        i,
        (x / r) * newR,
        (y / r) * newR,
        (z / r) * newR,
      )
    }

    posAttr.needsUpdate = true
    geo.computeVertexNormals()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, positions, baseRadius, type])

  // Gentle rotation for expected sphere
  useFrame((_, delta) => {
    if (meshRef.current && type === 'expected') {
      meshRef.current.rotation.y += delta * 0.02
    }
  })

  if (type === 'expected') {
    return (
      <mesh ref={meshRef}>
        <sphereGeometry ref={geoRef} args={[baseRadius, 64, 48]} />
        <meshPhysicalMaterial
          color={expectedColor}
          transparent
          opacity={0.08}
          wireframe
          wireframeLinewidth={1}
        />
      </mesh>
    )
  }

  return (
    <mesh ref={meshRef}>
      <sphereGeometry ref={geoRef} args={[baseRadius, 64, 48]} />
      <meshPhysicalMaterial
        color={actualColor}
        transparent
        opacity={0.35}
        roughness={0.2}
        metalness={0.1}
        clearcoat={0.8}
        clearcoatRoughness={0.2}
        envMapIntensity={0.5}
      />
    </mesh>
  )
}

// ============================================
// Module nodes (floating labeled points)
// ============================================

interface ModuleNodeProps {
  point: RadarDataPoint
  theta: number
  phi: number
  baseRadius: number
  index: number
  isHovered: boolean
  onHover: (index: number | null) => void
}

function ModuleNode({ point, theta, phi, baseRadius, index, isHovered, onHover }: ModuleNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const score = point.actual / 100
  const deform = 0.6 + score * 0.6
  const r = baseRadius * deform * 1.02

  // Position on sphere surface
  const position = useMemo(() => {
    const x = r * Math.sin(theta) * Math.cos(phi)
    const y = r * Math.cos(theta)
    const z = r * Math.sin(theta) * Math.sin(phi)
    return new THREE.Vector3(x, y, z)
  }, [r, theta, phi])

  const color = useMemo(() => gapColor(point.actual, point.expected), [point.actual, point.expected])

  // Pulse animation
  useFrame((state) => {
    if (meshRef.current) {
      const scale = isHovered ? 1.8 : 1 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.1
      meshRef.current.scale.setScalar(scale)
    }
  })

  // Extract short name
  const parts = point.module.split(' - ')
  const code = parts[0]?.trim() || ''
  const name = parts[1]?.trim() || parts[0]?.trim() || ''

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerEnter={() => onHover(index)}
        onPointerLeave={() => onHover(null)}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.8 : 0.3}
        />
      </mesh>

      {/* Label */}
      <Html
        distanceFactor={5}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          transition: 'all 0.2s ease',
          opacity: isHovered ? 1 : 0.85,
          transform: isHovered ? 'scale(1.15)' : 'scale(1)',
        }}
      >
        <div
          className="whitespace-nowrap text-center"
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
        >
          <div
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: color,
              color: '#fff',
            }}
          >
            {code}
          </div>
          {isHovered && (
            <div className="mt-1 bg-gray-900/90 text-white text-[10px] px-2 py-1.5 rounded-lg backdrop-blur-sm border border-white/10 min-w-[140px]">
              <p className="font-semibold text-[11px] mb-1">{name}</p>
              <div className="flex justify-between">
                <span className="text-gray-400">Score</span>
                <span className="font-bold" style={{ color }}>{point.actual}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Attendu</span>
                <span className="text-gray-300">{point.expected}%</span>
              </div>
              <div className="flex justify-between mt-0.5 pt-0.5 border-t border-white/10">
                <span className="text-gray-400">Ecart</span>
                <span className={point.actual >= point.expected ? 'text-green-400' : 'text-red-400'}>
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

// ============================================
// Connecting lines (edges between adjacent nodes)
// ============================================

function ConnectionLines({ data, positions, baseRadius }: {
  data: RadarDataPoint[]
  positions: [number, number][]
  baseRadius: number
}) {
  const lineGeo = useMemo(() => {
    const points: THREE.Vector3[] = []

    // Connect each node to its 2-3 nearest neighbors
    for (let i = 0; i < data.length; i++) {
      const [ti, pi] = positions[i]
      const si = 0.6 + (data[i].actual / 100) * 0.6
      const ri = baseRadius * si

      const xi = ri * Math.sin(ti) * Math.cos(pi)
      const yi = ri * Math.cos(ti)
      const zi = ri * Math.sin(ti) * Math.sin(pi)

      // Find 2 nearest
      const distances: { idx: number; dist: number }[] = []
      for (let j = 0; j < data.length; j++) {
        if (j === i) continue
        const [tj, pj] = positions[j]
        const cosD = Math.sin(ti) * Math.sin(tj) * Math.cos(pi - pj) + Math.cos(ti) * Math.cos(tj)
        distances.push({ idx: j, dist: Math.acos(Math.max(-1, Math.min(1, cosD))) })
      }
      distances.sort((a, b) => a.dist - b.dist)
      const nearest = distances.slice(0, 2)

      for (const n of nearest) {
        const j = n.idx
        if (j < i) continue // avoid duplicate lines
        const [tj, pj] = positions[j]
        const sj = 0.6 + (data[j].actual / 100) * 0.6
        const rj = baseRadius * sj

        const xj = rj * Math.sin(tj) * Math.cos(pj)
        const yj = rj * Math.cos(tj)
        const zj = rj * Math.sin(tj) * Math.sin(pj)

        points.push(new THREE.Vector3(xi, yi, zi))
        points.push(new THREE.Vector3(xj, yj, zj))
      }
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points)
    return geo
  }, [data, positions, baseRadius])

  return (
    <lineSegments geometry={lineGeo}>
      <lineBasicMaterial color="#7c3aed" transparent opacity={0.15} />
    </lineSegments>
  )
}

// ============================================
// Scene (inner component — runs inside Canvas)
// ============================================

interface SceneProps {
  data: RadarDataPoint[]
  colors?: { actual: string; expected: string }
}

function Scene({ data, colors }: SceneProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  const baseRadius = 2

  const positions = useMemo(() => fibonacciSphere(data.length), [data.length])

  // Slow auto-rotation
  useFrame((_, delta) => {
    if (groupRef.current && hoveredIndex === null) {
      groupRef.current.rotation.y += delta * 0.08
    }
  })

  const handleHover = useCallback((index: number | null) => {
    setHoveredIndex(index)
  }, [])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#f8fafc" />
      <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#c4b5fd" />
      <pointLight position={[0, 0, 0]} intensity={0.2} color="#7c3aed" />

      {/* Controls */}
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={8}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        autoRotate={false}
      />

      {/* Main group */}
      <group ref={groupRef}>
        {/* Expected sphere (wireframe reference) */}
        <DeformedSphere
          data={data}
          positions={positions}
          baseRadius={baseRadius}
          type="expected"
          colors={colors}
        />

        {/* Actual sphere (solid, deformed) */}
        <DeformedSphere
          data={data}
          positions={positions}
          baseRadius={baseRadius}
          type="actual"
          colors={colors}
        />

        {/* Connection lines */}
        <ConnectionLines data={data} positions={positions} baseRadius={baseRadius} />

        {/* Module nodes */}
        {data.map((point, i) => (
          <ModuleNode
            key={i}
            point={point}
            theta={positions[i][0]}
            phi={positions[i][1]}
            baseRadius={baseRadius}
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
// Main exported component
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
        camera={{ position: [0, 1.5, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene data={data} colors={colors} />
      </Canvas>

      {/* Legend overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-full px-5 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: colors?.actual || '#7c3aed' }} />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Niveau actuel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: colors?.expected || '#9ca3af' }} />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Attendu</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
          <span className="text-[10px] text-gray-500">&ge; Attendu</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          <span className="text-[10px] text-gray-500">&lt; Attendu</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-3 right-3 text-[10px] text-gray-400 dark:text-gray-500 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
        Cliquer-glisser pour tourner &bull; Molette pour zoomer
      </div>
    </div>
  )
}
