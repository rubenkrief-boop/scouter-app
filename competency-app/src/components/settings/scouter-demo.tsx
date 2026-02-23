'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScouterExplosion } from '@/components/animations/scouter-explosion'
import { Zap } from 'lucide-react'

export function ScouterDemo() {
  const [demoKey, setDemoKey] = useState(0)
  const [demoScore, setDemoScore] = useState(95)
  const [showDemo, setShowDemo] = useState(false)

  function handleDemo(score: number) {
    // Use a unique key each time to bypass sessionStorage
    setDemoScore(score)
    setDemoKey(prev => prev + 1)
    setShowDemo(true)
  }

  const handleDismiss = useCallback(() => {
    setShowDemo(false)
  }, [])

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            Animation Scouter
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Testez l&apos;animation qui se declenche quand un collaborateur atteint un score eleve
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleDemo(92)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              Score 92%
            </Button>
            <Button
              onClick={() => handleDemo(100)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Zap className="h-4 w-4 mr-2" />
              Score 100%
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            L&apos;animation se declenche automatiquement sur les pages de resultats quand le score
            est &ge; 90% ou que tous les modules sont au niveau attendu. Cliquez n&apos;importe ou pour fermer.
          </p>
        </CardContent>
      </Card>

      {showDemo && (
        <ScouterExplosion
          score={demoScore}
          triggered={true}
          storageKey={`scouter-demo-${demoKey}`}
          onDismiss={handleDismiss}
        />
      )}
    </>
  )
}
