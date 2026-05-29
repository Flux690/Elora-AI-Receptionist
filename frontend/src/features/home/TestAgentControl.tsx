import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  RoomAudioRenderer,
  useAgent,
  BarVisualizer,
  useSession,
  SessionProvider,
} from '@livekit/components-react'
import { TokenSource } from 'livekit-client'
import { toast } from 'sonner'
import { Mic, PhoneOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/apiClient'

interface TestSessionData {
  serverUrl: string
  token: string
  roomName: string
}

/**
 * "Test Agent" control that morphs in place — no modal. Idle it's a button;
 * while live it becomes a pill holding a BarVisualizer (driven by agent state)
 * and acts as the hang-up control. Clicking the live pill ends the session.
 */
export function TestAgentControl() {
  const [sessionData, setSessionData] = useState<TestSessionData | null>(null)
  const [loading, setLoading] = useState(false)

  const start = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await apiClient.post<TestSessionData>('/admin/agent/test')
      setSessionData(data)
    } catch (err: unknown) {
      console.error('[TestAgent] failed to start session:', err)
      toast.error("Couldn't start the test. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  const stop = useCallback(() => setSessionData(null), [])

  if (sessionData) {
    return <LiveControl sessionData={sessionData} onEnd={stop} />
  }

  return (
    <Button id="test-agent-btn" variant="default" size="lg" className="w-30" onClick={start} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
      {loading ? 'Connecting' : 'Test Agent'}
    </Button>
  )
}

function LiveControl({ sessionData, onEnd }: { sessionData: TestSessionData; onEnd: () => void }) {
  const tokenSource = useMemo(
    () => TokenSource.literal({ serverUrl: sessionData.serverUrl, participantToken: sessionData.token }),
    [sessionData]
  )

  const session = useSession(tokenSource, { agentName: 'receptionist' })
  const teardownRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // StrictMode-safe lifecycle: defer teardown a tick so StrictMode's
    // throwaway unmount→remount cancels it instead of killing the connection.
    if (teardownRef.current) {
      clearTimeout(teardownRef.current)
      teardownRef.current = undefined
    } else {
      session.start()
    }
    return () => {
      teardownRef.current = setTimeout(() => {
        session.end()
        teardownRef.current = undefined
      }, 0)
    }
  }, [session])

  return (
    <SessionProvider session={session}>
      <RoomAudioRenderer />
      <LivePill onEnd={onEnd} />
    </SessionProvider>
  )
}

function LivePill({ onEnd }: { onEnd: () => void }) {
  const agent = useAgent()

  return (
    <Button
      variant="default"
      size="lg"
      onClick={onEnd}
      className="w-30 gap-3"
      aria-label="End test"
    >
      {agent.microphoneTrack ? (
        <BarVisualizer
          state={agent.state}
          track={agent.microphoneTrack}
          barCount={5}
          options={{ minHeight: 50, maxHeight: 100 }}
          className="test-agent-viz h-6"
        />
      ) : (
        <Loader2 className="size-4 animate-spin" />
      )}
      <PhoneOff className="size-4" />
    </Button>
  )
}
