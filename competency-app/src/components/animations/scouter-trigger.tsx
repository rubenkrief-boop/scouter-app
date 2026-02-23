'use client'

import { ScouterExplosion } from './scouter-explosion'

interface ScouterTriggerProps {
  score: number
  triggered: boolean
  storageKey: string
}

export function ScouterTrigger({ score, triggered, storageKey }: ScouterTriggerProps) {
  return <ScouterExplosion score={score} triggered={triggered} storageKey={storageKey} />
}
