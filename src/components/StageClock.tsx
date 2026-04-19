import { useMemo, useState, type ReactNode } from 'react'
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
  /** Start / Reset (rendered above the large caller readout). */
  stageActions?: ReactNode
}

function isCountdownToken(text: string): boolean {
  return /^\d+$/.test(text.trim())
}

export function StageClock({
  members,
  targetArrivalGapSeconds,
  elapsedMs,
  stageActions,
}: StageClockProps) {
  const [showScriptStack, setShowScriptStack] = useState(false)

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
    <div className="mx-auto mt-4 w-full max-w-5xl">
      {stageActions}

      <div
        className="mt-6 min-h-[7.5rem] font-display text-6xl font-bold leading-[0.95] tracking-tight text-white sm:min-h-[9rem] sm:text-7xl md:min-h-[10rem] md:text-8xl lg:min-h-[11rem] lg:text-9xl xl:min-h-[12rem] xl:text-[8.5rem] 2xl:text-[10rem]"
        aria-live="assertive"
      >
        {members.length === 0 ? (
          <span className="font-sans text-lg font-medium leading-normal tracking-normal text-zinc-500 sm:text-xl">
            Add leads to the selected group to build the caller script.
          </span>
        ) : cue ? (
          cue
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-zinc-800/90 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-400 shadow-sm transition hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber-300">
          <input
            type="checkbox"
            checked={showScriptStack}
            onChange={(e) => setShowScriptStack(e.target.checked)}
            className="size-3.5 rounded border-zinc-600 bg-zinc-950 text-amber-500 focus:ring-amber-500/50"
          />
          Show Script
        </label>
      </div>

      {showScriptStack && members.length > 0 ? (
        <div
          className="mx-auto mt-4 max-h-52 w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-2 shadow-inner sm:max-h-60"
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
      ) : null}
    </div>
  )
}
