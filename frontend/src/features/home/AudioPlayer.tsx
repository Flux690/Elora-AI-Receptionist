import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { Play, Pause } from 'lucide-react'
import type { CallDetail } from '@receptionist/shared'
import { keys, fetchers } from '@/lib/queries'
import { Skeleton } from '@/components/ui/skeleton'

export interface AudioPlayerHandle {
  seekToEntry: (startTime: number | undefined) => void
}

interface AudioPlayerProps {
  callId: string
  callDetail: CallDetail
  onActiveIdxChange: (idx: number) => void
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ callId, callDetail, onActiveIdxChange }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const lastIdxRef = useRef(-1)
    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)

    // Pre-signed URLs typically expire ~1hr — never cache them.
    const { data: recording, isLoading } = useQuery({
      queryKey: keys.callRecording(callId),
      queryFn: () => fetchers.callRecording(callId),
      enabled: !!callDetail.recordingUrl,
      staleTime: 0,
      gcTime: 0,
    })

    const callStartMs = useMemo(
      () => new Date(callDetail.startedAt).getTime(),
      [callDetail.startedAt],
    )

    /**
     * Bidirectional incremental scan from the last-known active index.
     * Avoids the full O(n) loop on every audio timeupdate event.
     */
    function findActiveIdx(currentSec: number): number {
      const transcript = callDetail.transcript
      if (!transcript || transcript.length === 0) return -1

      const offsetForEntry = (i: number): number | null => {
        const e = transcript[i]
        if (e.startTime == null) return null
        return (e.startTime - callStartMs) / 1000
      }

      let idx = lastIdxRef.current
      // Scan forward
      while (idx + 1 < transcript.length) {
        const off = offsetForEntry(idx + 1)
        if (off == null || off > currentSec) break
        idx++
      }
      // Scan backward (e.g. user seeked backwards)
      while (idx >= 0) {
        const off = offsetForEntry(idx)
        if (off != null && off <= currentSec) break
        idx--
      }
      return idx
    }

    function handleTimeUpdate() {
      const a = audioRef.current
      if (!a) return
      setCurrentTime(a.currentTime)
      const idx = findActiveIdx(a.currentTime)
      if (idx !== lastIdxRef.current) {
        lastIdxRef.current = idx
        onActiveIdxChange(idx)
      }
    }

    function seekToEntry(startTime: number | undefined) {
      const a = audioRef.current
      if (!a || startTime == null) return
      const offset = (startTime - callStartMs) / 1000
      a.currentTime = Math.max(0, offset)
      a.play().then(() => setPlaying(true)).catch(() => {})
    }

    useImperativeHandle(ref, () => ({ seekToEntry }), [callStartMs])

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

    function handleSeekBar(e: React.ChangeEvent<HTMLInputElement>) {
      const a = audioRef.current
      if (!a) return
      const t = Number(e.target.value)
      a.currentTime = t
      setCurrentTime(t)
    }

    const pct = duration > 0 ? (currentTime / duration) * 100 : 0
    const fmtTime = (s: number) =>
      `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

    if (!callDetail.recordingUrl) {
      return (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
          No recording available for this call.
        </div>
      )
    }

    if (isLoading) {
      return <Skeleton className="h-16 w-full rounded-lg" />
    }

    return (
      <div className="rounded-lg border border-border bg-card p-4">
        {recording?.url && (
          <audio
            ref={audioRef}
            src={recording.url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
            onEnded={() => setPlaying(false)}
            preload="metadata"
          />
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-150 hover:bg-primary-hover active:scale-95"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-0.5" />}
          </button>
          <div className="flex flex-1 flex-col gap-1">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-none"
                style={{ width: `${pct}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeekBar}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
                aria-label="Seek"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmtTime(currentTime)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
)

export default AudioPlayer
