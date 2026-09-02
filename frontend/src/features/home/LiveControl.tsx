import { useEffect, useMemo, useRef } from 'react'
import {
  RoomAudioRenderer,
  useAgent,
  BarVisualizer,
  useSession,
  SessionProvider,
} from '@livekit/components-react'
import { TokenSource } from 'livekit-client'
import { Loader2, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TestSessionData {
  serverUrl: string
  token: string
  roomName: string
}

function LivePill({ onEnd }: { onEnd: () => void }) {
  const agent = useAgent()
  return (
    <Button onClick={onEnd} size="lg" className="w-30 gap-3" aria-label="End the test">
      {agent.microphoneTrack ? (
        <BarVisualizer
          state={agent.state}
          track={agent.microphoneTrack}
          barCount={5}
          options={{ minHeight: 50, maxHeight: 100 }}
          className="test-agent-viz h-6"
        />
      ) : (
        <Loader2 className="animate-spin" />
      )}
      <PhoneOff />
    </Button>
  )
}

export default function LiveControl({
  sessionData,
  onEnd,
}: {
  sessionData: TestSessionData
  onEnd: () => void
}) {
  const tokenSource = useMemo(
    () =>
      TokenSource.literal({
        serverUrl: sessionData.serverUrl,
        participantToken: sessionData.token,
      }),
    [sessionData],
  )

  const session = useSession(tokenSource, { agentName: 'receptionist' })
  const teardownRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    /* Teardown is deferred a tick so StrictMode's throwaway unmount and remount
       cancels it rather than killing a live connection. */
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
