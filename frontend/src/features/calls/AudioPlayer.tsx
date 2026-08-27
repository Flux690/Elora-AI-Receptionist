import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Play, Pause } from 'lucide-react'
import { keys, fetchers } from '@/lib/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface AudioPlayerProps {
  callId: string
  hasRecording: boolean
}

/**
 * Play, pause, scrub. Nothing else.
 *
 * Click-to-seek from a transcript line used to live here and has been removed
 * (PLAN.md 2.8.1). It never worked: a transcript entry stored `item.createdAt`,
 * which for a caller turn is *after* speech-to-text finalised and for an agent
 * turn is *before* the audio played, while offsets were computed against
 * `calls.started_at` — a database default — and the audio file begins whenever
 * egress actually started. Three unrelated clocks, so the seek drifted, and
 * drifted further the longer the call. Fixing it properly means anchoring to
 * the recording start and capturing speech-start times; that is not worth the
 * work for a convenience feature, so the feature is gone rather than wrong.
 */
export default function AudioPlayer({ callId, hasRecording }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Pre-signed URLs expire in about an hour — never cache them.
  const { data: recording, isLoading } = useQuery({
    queryKey: keys.callRecording(callId),
    queryFn: () => fetchers.callRecording(callId),
    enabled: hasRecording,
    staleTime: 0,
    gcTime: 0,
  })

  function togglePlay() {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  function handleSeek(value: number | readonly number[]) {
    const a = audioRef.current
    if (!a) return
    const t = Array.isArray(value) ? value[0]! : (value as number)
    a.currentTime = t
    setCurrentTime(t)
  }

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  if (!hasRecording) {
    return (
      <p className="text-sm text-muted-foreground">
        No recording available for this call.
      </p>
    )
  }

  if (isLoading) return <Skeleton className="h-14 w-full rounded-lg" />

  return (
    <div className="rounded-lg border border-input bg-card p-3">
      {recording?.url && (
        <audio
          ref={audioRef}
          src={recording.url}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onEnded={() => setPlaying(false)}
          preload="metadata"
        />
      )}
      <div className="flex items-center gap-3">
        <Button
          onClick={togglePlay}
          size="icon"
          className="shrink-0 rounded-full"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="ml-0.5 size-3.5" />}
        </Button>

        <span className="w-9 text-sm text-muted-foreground tabular-nums">
          {fmtTime(currentTime)}
        </span>

        <Slider
          className="flex-1"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onValueChange={handleSeek}
          aria-label="Seek"
        />

        <span className="w-9 text-sm text-muted-foreground tabular-nums">
          {fmtTime(duration)}
        </span>
      </div>
    </div>
  )
}
