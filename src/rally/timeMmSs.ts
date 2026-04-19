/** Parse "m:ss" or "mm:ss" into total seconds. Minutes may exceed two digits (e.g. "120:00"). */
export function parseMmSsToSeconds(input: string): number | null {
  const t = input.trim()
  if (!t) return 0

  const m = t.match(/^(\d+):(\d{1,2})$/)
  if (!m) return null

  const minutes = Number(m[1])
  const seconds = Number(m[2])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  if (seconds > 59 || minutes < 0 || minutes > 9999) return null

  return minutes * 60 + seconds
}

/** Format total seconds as mm:ss (minutes zero-padded to width 2 when minutes < 100). */
export function formatSecondsAsMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(s / 60)
  const secs = s % 60
  const mm =
    minutes >= 100 ? String(minutes) : String(minutes).padStart(2, '0')
  return `${mm}:${String(secs).padStart(2, '0')}`
}
