import { useMemo, type ReactNode } from 'react'
import {
  buildScriptEvents,
  buildScriptLines,
  computeDepartureRows,
  cueAtScriptSecond,
  remainingScriptLines,
} from '../rally/scriptEngine'
import type { RallyLeadEntry } from '../rally/rallyTypes'

type StageClockProps = {
  members: RallyLeadEntry[]
  targetArrivalGapSeconds: number
  /** Same clock as the stage timer (whole seconds drive the caller script). */
  elapsedMs: number
  /** Controls visibility of the script list panel. */
  showScriptStack: boolean
  /** Controls rendered with the primary cue group. */
  stageActions?: ReactNode
  /** Optional label shown above the large caller readout. */
  cueHeading?: ReactNode
}

function isCountdownToken(text: string): boolean {
  return /^\d+$/.test(text.trim())
}

export function StageClock({
  members,
  targetArrivalGapSeconds,
  elapsedMs,
  showScriptStack,
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

  return (
    <>
      {cueHeading ? (
        <div className="mt-0 mb-1 text-center font-display text-xl font-semibold tracking-wide text-zinc-300">
          {cueHeading}
        </div>
      ) : null}
      <div
        className={`mt-4 grid w-full items-start gap-8 ${
          showScriptStack
            ? 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
            : 'grid-cols-1 justify-items-center'
        }`}
      >
        {members.length === 0 ? (
          <div
            className={`w-full rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-8 text-center shadow-inner ${
              showScriptStack ? 'md:col-span-2' : 'max-w-4xl'
            }`}
          >
            <p className="font-sans text-lg font-medium leading-normal tracking-normal text-zinc-400 sm:text-xl">
              Add leads to the selected group to build the caller script.
            </p>
          </div>
        ) : (
          <>
            <div
              className={`min-w-0 text-center ${showScriptStack ? '' : 'w-full max-w-4xl'}`}
            >
              {stageActions}
              <div
                className={`mt-4 break-words font-display font-bold leading-[0.95] tracking-tight text-white ${
                  showScriptStack
                    ? 'min-h-[6.5rem] text-5xl sm:min-h-[7rem] sm:text-6xl md:min-h-[8rem] md:text-7xl lg:min-h-[9rem] lg:text-8xl xl:text-[7rem] 2xl:text-[8rem]'
                    : 'min-h-[7.5rem] text-6xl sm:min-h-[9rem] sm:text-7xl md:min-h-[10rem] md:text-8xl lg:min-h-[11rem] lg:text-9xl xl:min-h-[12rem] xl:text-[8.5rem] 2xl:text-[10rem]'
                }`}
                aria-live="assertive"
              >
                {cue ? cue : <span className="text-zinc-500">—</span>}
              </div>
            </div>

            {showScriptStack ? (
              <div className="min-w-0">
                <div
                  className="mt-2 w-full rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-2 shadow-inner md:mt-4"
                  aria-label="Remaining caller script"
                >
                  {stackLines.length === 0 ? (
                    <p className="py-3 text-center text-xs text-zinc-500">Script complete</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {stackLines.map((line) => {
                        const lineKey = line.segments.map((s) => s.t).join('-')
                        return (
                          <div
                            key={lineKey}
                            className="rounded-md border border-zinc-800/80 bg-zinc-900/80 px-2.5 py-2 text-center font-display text-sm font-semibold leading-snug tracking-tight text-zinc-200 sm:text-base"
                          >
                            {line.segments.map((seg, j) => {
                              const onStage = seg.t === scriptSecond
                              const count = isCountdownToken(seg.text)
                              return (
                                <span key={seg.t}>
                                  {j > 0 ? (
                                    <span className="select-none text-zinc-600" aria-hidden>
                                      {' '}
                                      ·{' '}
                                    </span>
                                  ) : null}
                                  <span
                                    className={
                                      onStage
                                        ? count
                                          ? 'rounded-md bg-amber-500/30 px-1.5 py-0.5 font-mono tabular-nums text-amber-50 ring-1 ring-amber-400/60'
                                          : 'rounded-md bg-amber-500/30 px-1.5 py-0.5 text-amber-50 ring-1 ring-amber-400/60'
                                        : count
                                          ? 'font-mono tabular-nums text-zinc-300'
                                          : 'text-zinc-100'
                                    }
                                  >
                                    {seg.text}
                                  </span>
                                </span>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
