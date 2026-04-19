import type { RallyLeadEntry } from './rallyTypes'

export type ScriptEvent = {
  /** Whole second index on the script timeline (0 = first “3”). */
  t: number
  text: string
}

export type DepartureRow = {
  name: string
  /** Relative script timeline second when this lead should rally (integer). */
  departureSec: number
  /** Original list index for stable sort. */
  order: number
}

/**
 * Roster march time is march duration Dᵢ (seconds from rally go to fort).
 * Target fort arrival for list index i: T₀ + i × G (G = target arrival gap).
 * Rally go time: T₀ + i × G − Dᵢ. T₀ = maxᵢ(Dᵢ − i × G) keeps departures ≥ 0;
 * G = 0 ⇒ same target instant at max(D); longer marches rally earlier.
 */
export function computeDepartureRows(
  membersInListOrder: RallyLeadEntry[],
  targetArrivalGapSeconds: number,
): DepartureRow[] {
  const gap = Math.max(0, Math.floor(targetArrivalGapSeconds))
  const n = membersInListOrder.length
  if (n === 0) return []

  const marchDurSec = membersInListOrder.map((m) => {
    const march = Math.max(0, Math.floor(m.marchTimeSeconds))
    const travel = Math.max(0, Math.floor(m.travelTimeSeconds))
    return march + travel
  })

  let base = 0
  for (let i = 0; i < n; i++) {
    base = Math.max(base, marchDurSec[i]! - i * gap)
  }

  const rows = membersInListOrder.map((m, i) => ({
    name: m.name.trim() || 'Lead',
    order: i,
    departureSec: base + i * gap - marchDurSec[i]!,
  }))
  rows.sort((a, b) => {
    if (a.departureSec !== b.departureSec) return a.departureSec - b.departureSec
    return a.order - b.order
  })
  return rows
}

function mergePush(events: ScriptEvent[], t: number, text: string) {
  const existing = events.find((e) => e.t === t)
  if (existing) {
    existing.text = `${existing.text}, ${text}`
  } else {
    events.push({ t, text })
  }
}

/**
 * Build per-second cues: first departure uses 3,2,1,[Name]; later gaps use
 * (G−1)…1 then [Name] for integer gap G between sorted departures.
 */
export function buildScriptEvents(sorted: DepartureRow[]): ScriptEvent[] {
  const events: ScriptEvent[] = []
  if (sorted.length === 0) return events

  const d = sorted.map((r) => r.departureSec)
  const names = sorted.map((r) => r.name)

  mergePush(events, 0, '3')
  mergePush(events, 1, '2')
  mergePush(events, 2, '1')
  mergePush(events, 3, names[0]!)

  let nameT = 3
  for (let k = 1; k < sorted.length; k++) {
    const G = Math.max(0, d[k]! - d[k - 1]!)
    const prevNameT = nameT
    nameT = prevNameT + G

    if (G <= 1) {
      mergePush(events, nameT, names[k]!)
      continue
    }

    for (let s = 1; s <= G - 1; s++) {
      mergePush(events, prevNameT + s, String(G - s))
    }
    mergePush(events, nameT, names[k]!)
  }

  events.sort((a, b) => a.t - b.t)
  return events
}

export function cueAtScriptSecond(
  events: ScriptEvent[],
  scriptSecond: number,
): string {
  const hit = events.find((e) => e.t === scriptSecond)
  return hit?.text ?? ''
}

/** One spoken token at script second `t` (countdown digit or lead name). */
export type ScriptLineSegment = {
  t: number
  text: string
}

/** A full caller line: countdown + name for one rally go (same structure as {@link buildScriptEvents}). */
export type ScriptLine = {
  segments: ScriptLineSegment[]
}

function lineEndSecond(line: ScriptLine): number {
  if (line.segments.length === 0) return -1
  return Math.max(...line.segments.map((s) => s.t))
}

/**
 * Caller lines for the stack UI: each line is one countdown + name block.
 * Same-second names (zero gap) are merged into the previous line’s last segment.
 */
export function buildScriptLines(sorted: DepartureRow[]): ScriptLine[] {
  const lines: ScriptLine[] = []
  if (sorted.length === 0) return lines

  const d = sorted.map((r) => r.departureSec)
  const names = sorted.map((r) => r.name)

  lines.push({
    segments: [
      { t: 0, text: '3' },
      { t: 1, text: '2' },
      { t: 2, text: '1' },
      { t: 3, text: names[0]! },
    ],
  })

  let nameT = 3
  for (let k = 1; k < sorted.length; k++) {
    const G = Math.max(0, d[k]! - d[k - 1]!)
    const prevNameT = nameT
    nameT = prevNameT + G

    if (G <= 1) {
      if (G === 0) {
        const lastLine = lines[lines.length - 1]!
        const lastSeg = lastLine.segments[lastLine.segments.length - 1]!
        if (lastSeg.t === nameT) {
          lastSeg.text = `${lastSeg.text}, ${names[k]!}`
        }
      } else {
        lines.push({ segments: [{ t: nameT, text: names[k]! }] })
      }
      continue
    }

    const segs: ScriptLineSegment[] = []
    for (let s = 1; s <= G - 1; s++) {
      segs.push({ t: prevNameT + s, text: String(G - s) })
    }
    segs.push({ t: nameT, text: names[k]! })
    lines.push({ segments: segs })
  }

  return lines
}

/** Lines not yet fully completed (still on or before the name/countdown second). */
export function remainingScriptLines(
  lines: ScriptLine[],
  scriptSecond: number,
): ScriptLine[] {
  const s = Math.floor(scriptSecond)
  return lines.filter((line) => s <= lineEndSecond(line))
}

export function lastScriptSecond(events: ScriptEvent[]): number {
  if (events.length === 0) return -1
  return Math.max(...events.map((e) => e.t))
}
