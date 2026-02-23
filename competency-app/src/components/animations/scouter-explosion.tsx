'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import './scouter-explosion.css'

interface ScouterExplosionProps {
  score: number
  triggered: boolean
  storageKey: string
  onDismiss?: () => void
}

export function ScouterExplosion({ score, triggered, storageKey, onDismiss }: ScouterExplosionProps) {
  const [show, setShow] = useState(false)
  const [phase, setPhase] = useState<'scan' | 'lock' | 'explode' | 'done'>('scan')
  const [displayNumber, setDisplayNumber] = useState(0)
  const [mounted, setMounted] = useState(false)
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  // Only show on client, check sessionStorage
  useEffect(() => {
    setMounted(true)
    if (!triggered) return

    const dismissed = sessionStorage.getItem(storageKey)
    if (dismissed) return

    setShow(true)
    setPhase('scan')
    setDisplayNumber(0)
    startTimeRef.current = Date.now()
  }, [triggered, storageKey])

  // Animate number counter during scan phase
  useEffect(() => {
    if (!show || phase !== 'scan') return

    const duration = 2500 // 2.5 seconds
    const startTime = Date.now()

    function animate() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Eased progress for dramatic effect
      const eased = progress < 0.8
        ? progress * 1.25 // Linear speedup
        : 1 - Math.pow(1 - progress, 3) // Ease out at end

      // Random fluctuation during scanning
      const fluctuation = progress < 0.85
        ? Math.floor(Math.random() * 20) - 10
        : 0

      const currentNum = Math.min(
        Math.floor(eased * score) + fluctuation,
        score
      )
      setDisplayNumber(Math.max(0, currentNum))

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Lock the number
        setDisplayNumber(score)
        setPhase('lock')
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [show, phase, score])

  // Phase transitions
  useEffect(() => {
    if (!show) return

    if (phase === 'lock') {
      // After 1.5s of lock, explode
      const timer = setTimeout(() => setPhase('explode'), 1500)
      return () => clearTimeout(timer)
    }

    if (phase === 'explode') {
      // After 1.5s of explosion, done
      const timer = setTimeout(() => {
        setPhase('done')
        setShow(false)
        sessionStorage.setItem(storageKey, 'dismissed')
        onDismiss?.()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [show, phase, storageKey])

  const handleDismiss = useCallback(() => {
    setShow(false)
    setPhase('done')
    sessionStorage.setItem(storageKey, 'dismissed')
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    onDismiss?.()
  }, [storageKey, onDismiss])

  if (!mounted || !show) return null

  // Generate spark particles for explosion
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360
    const distance = 150 + Math.random() * 200
    const x = Math.cos((angle * Math.PI) / 180) * distance
    const y = Math.sin((angle * Math.PI) / 180) * distance
    const size = 4 + Math.random() * 8
    const delay = Math.random() * 0.3
    return { x, y, size, delay, angle }
  })

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] cursor-pointer select-none"
      onClick={handleDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Escape' && handleDismiss()}
    >
      {/* Green visor overlay */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          background: phase === 'explode'
            ? 'transparent'
            : 'radial-gradient(ellipse at center, rgba(0, 255, 0, 0.15) 0%, rgba(0, 80, 0, 0.4) 100%)',
          animation: phase === 'scan'
            ? 'scouter-visor-in 0.5s ease-out forwards'
            : phase === 'explode'
              ? 'scouter-fade-out 1s ease-out forwards'
              : undefined,
        }}
      />

      {/* Scanline */}
      {phase === 'scan' && (
        <div
          className="absolute inset-x-0 h-1"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(0, 255, 0, 0.6), transparent)',
            animation: 'scouter-scanline 1.2s linear infinite',
          }}
        />
      )}

      {/* HUD corners */}
      {(phase === 'scan' || phase === 'lock') && (
        <>
          {/* Top-left bracket */}
          <div
            className="absolute top-8 left-8"
            style={{ animation: 'scouter-hud-in 0.3s ease-out forwards' }}
          >
            <div className="w-16 h-16 border-l-2 border-t-2 border-green-400/60" />
          </div>
          {/* Top-right bracket */}
          <div
            className="absolute top-8 right-8"
            style={{ animation: 'scouter-hud-in 0.3s ease-out 0.1s forwards', opacity: 0 }}
          >
            <div className="w-16 h-16 border-r-2 border-t-2 border-green-400/60" />
          </div>
          {/* Bottom-left bracket */}
          <div
            className="absolute bottom-8 left-8"
            style={{ animation: 'scouter-hud-in 0.3s ease-out 0.2s forwards', opacity: 0 }}
          >
            <div className="w-16 h-16 border-l-2 border-b-2 border-green-400/60" />
          </div>
          {/* Bottom-right bracket */}
          <div
            className="absolute bottom-8 right-8"
            style={{ animation: 'scouter-hud-in 0.3s ease-out 0.3s forwards', opacity: 0 }}
          >
            <div className="w-16 h-16 border-r-2 border-b-2 border-green-400/60" />
          </div>

          {/* HUD text top */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 text-green-400/60 text-xs font-mono tracking-[0.3em] uppercase"
            style={{ animation: 'scouter-hud-in 0.5s ease-out 0.2s forwards', opacity: 0 }}
          >
            SCOUTER v9.1 /// ANALYSE EN COURS
          </div>

          {/* Power bar */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-64">
            <div className="h-1.5 bg-green-900/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full"
                style={{
                  ['--bar-target' as string]: `${score}%`,
                  animation: 'scouter-bar-fill 2.5s ease-out forwards',
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Center content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          animation: phase === 'lock' ? 'scouter-shake 0.5s ease-in-out 0.8s 3' : undefined,
        }}
      >
        {/* Label */}
        {(phase === 'scan' || phase === 'lock') && (
          <div
            className="text-green-400/80 font-mono text-sm tracking-[0.2em] uppercase mb-4"
            style={{
              animation: phase === 'lock'
                ? 'scouter-text-reveal 0.6s ease-out forwards'
                : 'scouter-hud-in 0.5s ease-out 0.5s forwards',
              opacity: phase === 'scan' ? 0 : undefined,
            }}
          >
            {phase === 'lock' ? 'NIVEAU DE PUISSANCE' : 'SCAN...'}
          </div>
        )}

        {/* The big number */}
        {(phase === 'scan' || phase === 'lock') && (
          <div
            className="font-mono font-black text-green-400 tabular-nums"
            style={{
              fontSize: phase === 'lock' ? '8rem' : '6rem',
              lineHeight: 1,
              animation: 'scouter-number-pulse 0.5s ease-in-out infinite',
              transition: 'font-size 0.3s ease-out',
            }}
          >
            {displayNumber}%
          </div>
        )}

        {/* Sub-text on lock */}
        {phase === 'lock' && (
          <div
            className="mt-4 text-green-300 font-mono text-lg tracking-[0.15em] font-bold"
            style={{
              animation: 'scouter-text-reveal 0.4s ease-out 0.3s forwards',
              opacity: 0,
            }}
          >
            {score >= 100
              ? 'PUISSANCE MAXIMALE !!!'
              : score >= 90
                ? 'C\'EST PLUS DE 9000 !!!'
                : 'OBJECTIF ATTEINT !'}
          </div>
        )}

        {/* Explosion effect */}
        {phase === 'explode' && (
          <>
            {/* White flash */}
            <div
              className="absolute inset-0 bg-white"
              style={{ animation: 'scouter-flash 0.8s ease-out forwards' }}
            />

            {/* Explosion ring */}
            <div
              className="absolute w-32 h-32 rounded-full border-4 border-orange-500"
              style={{
                animation: 'scouter-explode 1s ease-out forwards',
                boxShadow: '0 0 60px rgba(255, 165, 0, 0.8), inset 0 0 60px rgba(255, 165, 0, 0.4)',
              }}
            />

            {/* Second ring */}
            <div
              className="absolute w-20 h-20 rounded-full border-2 border-yellow-400"
              style={{
                animation: 'scouter-explode 1.2s ease-out 0.1s forwards',
                boxShadow: '0 0 40px rgba(255, 255, 0, 0.6)',
              }}
            />

            {/* Sparks */}
            {sparks.map((spark, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: spark.size,
                  height: spark.size,
                  background: i % 3 === 0
                    ? '#ff6b00'
                    : i % 3 === 1
                      ? '#ffaa00'
                      : '#ff3300',
                  boxShadow: `0 0 ${spark.size * 2}px ${i % 2 === 0 ? '#ff6b00' : '#ffaa00'}`,
                  animation: `scouter-spark 1s ease-out ${spark.delay}s forwards`,
                  transform: `translate(${spark.x}px, ${spark.y}px)`,
                }}
              />
            ))}

            {/* Crack shards (left) */}
            <div
              className="absolute w-40 h-60"
              style={{
                clipPath: 'polygon(50% 0%, 0% 50%, 30% 100%, 70% 80%, 50% 30%)',
                background: 'linear-gradient(135deg, rgba(0, 255, 0, 0.3), transparent)',
                animation: 'scouter-crack-left 1s ease-out forwards',
              }}
            />

            {/* Crack shards (right) */}
            <div
              className="absolute w-40 h-60"
              style={{
                clipPath: 'polygon(50% 0%, 100% 50%, 70% 100%, 30% 80%, 50% 30%)',
                background: 'linear-gradient(-135deg, rgba(0, 255, 0, 0.3), transparent)',
                animation: 'scouter-crack-right 1s ease-out forwards',
              }}
            />
          </>
        )}
      </div>

      {/* Dismiss hint */}
      {(phase === 'scan' || phase === 'lock') && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-green-400/40 text-xs font-mono">
          Cliquer pour fermer
        </div>
      )}
    </div>,
    document.body
  )
}
