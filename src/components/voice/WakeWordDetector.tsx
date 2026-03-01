import { useState, useCallback } from 'react'
import { useWakeWord } from '@/hooks/useWakeWord'
import { Button } from '@/components/ui/button'

export function WakeWordDetector() {
  const [recording, setRecording] = useState(false)

  const handleDetected = useCallback(() => {
    setRecording(true)
    // Future: start recording audio for transcription
    setTimeout(() => setRecording(false), 5000)
  }, [])

  const { isListening, isSupported, start, stop } = useWakeWord({
    phrase: 'hey claw',
    onDetected: handleDetected,
  })

  if (!isSupported) return null

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isListening ? 'destructive' : 'outline'}
        size="sm"
        onClick={isListening ? stop : start}
      >
        {isListening ? 'Stop Listening' : 'Enable Wake Word'}
      </Button>
      {isListening && <span className="text-xs text-muted-foreground">Listening for &quot;Hey Claw&quot;...</span>}
      {recording && <span className="text-xs text-red-500">Recording...</span>}
    </div>
  )
}
