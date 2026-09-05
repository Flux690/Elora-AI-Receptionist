/**
 * Human-readable formatting, in the business's timezone rather than the
 * viewer's. The agent quotes every time in `agents.timezone`, so the dashboard
 * has to agree or an owner reading from another zone sees different times than
 * their callers were given.
 */

/** US/CA E.164. Numbers from other regions fall through to their raw string. */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}

export function formatDate(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  })
}

export function formatTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
}

export function formatDateTime(iso: string, timeZone?: string): string {
  return `${formatDate(iso, timeZone)} ${formatTime(iso, timeZone)}`
}

/** The day a moment falls on in a given zone, as `YYYY-MM-DD`. */
export function dayKey(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone })
}

/** "Today", "Yesterday", or the weekday and date. */
export function relativeDay(iso: string, timeZone?: string, now = new Date()): string {
  const key = dayKey(iso, timeZone)
  if (key === dayKey(now.toISOString(), timeZone)) return 'Today'
  const yesterday = new Date(now.getTime() - 86_400_000)
  if (key === dayKey(yesterday.toISOString(), timeZone)) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone,
  })
}

/** "1m 23s" or "45s". Null while a call is still running. */
export function formatDuration(startedAt: string, endedAt: string | null): string | null {
  if (!endedAt) return null
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 0) return null
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m === 0 ? `${s}s` : `${m}m ${s}s`
}

/** "45 min", "2 hr", "1 hr 30 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/**
 * Who called, in one string.
 *
 * A name is what an owner ringing somebody back actually needs; the number is
 * the fallback, and "Unknown caller" is the honest answer when there is neither.
 * "No caller ID" is deliberately *not* used here — it means only the number is
 * missing, which is a different fact and gets said where the number is shown on
 * its own.
 */
export function formatCaller(
  name: string | null | undefined,
  phone: string | null | undefined,
): string {
  const n = name?.trim()
  if (n && phone) return `${n} · ${formatPhone(phone)}`
  if (n) return n
  if (phone) return formatPhone(phone)
  return 'Unknown caller'
}

/**
 * What a number field accepts: digits, and nothing else.
 *
 * Kept out of the component so it can be tested without a DOM — the frontend
 * runner is node, because the only other suite reads `index.css` off disk.
 *
 * Never returns NaN. An empty box, a pasted "abc", a stray minus sign and a
 * decimal point all land on 0 rather than poisoning the arithmetic downstream,
 * where the value becomes an appointment length.
 */
export function digitsToNumber(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  const n = Number(digits)
  return Number.isFinite(n) ? n : 0
}
