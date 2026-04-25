import { useMemo, type ReactNode } from 'react'
import { CallerScriptDisplay } from './CallerScriptDisplay'
import { FixedStartDisplay } from './FixedStartDisplay'
import {
  buildScriptEvents,
  buildScriptLines,
  computeDepartureRows,
  cueAtScriptSecond,
  remainingScriptLines,
} from '../rally/scriptEngine'
import type { RallyLeadEntry } from '../rally/rallyTypes'
import { formatSecondsAsMmSs } from '../rally/timeMmSs'

type StageClockProps = {
  members: RallyLeadEntry[]
  targetArrivalGapSeconds: number
  displayMode: 'caller-script' | 'manual-starts'
  manualStartTime: string
  onManualStartTimeChange: (value: string) => void
  marchTimeOverrideSecondsByLeadId: Record<string, number>
  /** Same clock as the stage timer (whole seconds drive the caller script). */
  elapsedMs: number
  /** Controls rendered with the primary cue group. */
  stageActions?: ReactNode
  /** Optional label shown above the large caller readout. */
  cueHeading?: ReactNode
}

export function StageClock({
  members,
  targetArrivalGapSeconds,
  displayMode,
  manualStartTime,
  onManualStartTimeChange,
  marchTimeOverrideSecondsByLeadId,
  elapsedMs,
  stageActions,
  cueHeading,
}: StageClockProps) {
  const rows = useMemo(
    () => computeDepartureRows(members, targetArrivalGapSeconds),
    [members, targetArrivalGapSeconds],
  )

  const events = useMemo(() => buildScriptEvents(rows), [rows])

  const scriptLines = useMemo(() => buildScriptLines(rows), [rows])

  const scriptSecond = Math.floor(elapsedMs / 1000)
  const cue = cueAtScriptSecond(events, scriptSecond)

  const stackLines = useMemo(
    () => remainingScriptLines(scriptLines, scriptSecond),
    [scriptLines, scriptSecond],
  )

  const manualStartSeconds = useMemo(() => {
    const parts = manualStartTime.split(':').map((part) => Number.parseInt(part, 10))
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null
    const [hours, minutes, seconds] = parts
    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return null
    }
    return hours * 3600 + minutes * 60 + seconds
  }, [manualStartTime])

  const manualScheduleRows = useMemo(() => {
    if (manualStartSeconds === null) return []
    return rows
      .map((row) => {
      const lead = members[row.order]
      const marchTimeUsedSeconds = Math.max(
        0,
        Math.floor((lead?.marchTimeSeconds ?? 0) + (lead?.travelTimeSeconds ?? 0)),
      )
      const totalSeconds = ((manualStartSeconds + row.departureSec) % 86400 + 86400) % 86400
      const arrivalTotalSeconds = (totalSeconds + marchTimeUsedSeconds) % 86400
      const offsetHours = Math.floor(row.departureSec / 3600)
      const offsetMinutes = Math.floor((row.departureSec % 3600) / 60)
      const offsetSeconds = row.departureSec % 60
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      const arrivalHours = Math.floor(arrivalTotalSeconds / 3600)
      const arrivalMinutes = Math.floor((arrivalTotalSeconds % 3600) / 60)
      const arrivalSeconds = arrivalTotalSeconds % 60
      return {
        ...row,
        leadId: lead?.id ?? `order-${row.order}`,
        fromStartSeconds: row.departureSec,
        startAtTotalSeconds: totalSeconds,
        arrivalTotalSeconds,
        marchTimeUsed: formatSecondsAsMmSs(marchTimeUsedSeconds),
        marchTimeIsOverride: Boolean(
          lead && marchTimeOverrideSecondsByLeadId[lead.id] !== undefined,
        ),
        offsetFromStart: `+${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}:${String(offsetSeconds).padStart(2, '0')}`,
        startAt: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
        arrivalAt: `${String(arrivalHours).padStart(2, '0')}:${String(arrivalMinutes).padStart(2, '0')}:${String(arrivalSeconds).padStart(2, '0')}`,
      }
    })
      .sort((a, b) => {
        if (a.arrivalTotalSeconds !== b.arrivalTotalSeconds) {
          return a.arrivalTotalSeconds - b.arrivalTotalSeconds
        }
        return a.order - b.order
      })
  }, [manualStartSeconds, rows, members, marchTimeOverrideSecondsByLeadId])

  if (displayMode === 'manual-starts') {
    return (
      <FixedStartDisplay
        cueHeading={cueHeading}
        membersCount={members.length}
        manualStartTime={manualStartTime}
        onManualStartTimeChange={onManualStartTimeChange}
        manualStartSeconds={manualStartSeconds}
        manualScheduleRows={manualScheduleRows}
      />
    )
  }

  return (
    <CallerScriptDisplay
      cueHeading={cueHeading}
      membersCount={members.length}
      showScriptStack
      stageActions={stageActions}
      cue={cue}
      stackLines={stackLines}
      scriptSecond={scriptSecond}
    />
  )
}
