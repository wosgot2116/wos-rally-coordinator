import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'

type FixedStartScheduleRow = {
  leadId: string
  name: string
  order: number
  fromStartSeconds: number
  startAtTotalSeconds: number
  arrivalTotalSeconds: number
  marchTimeUsed: string
  marchTimeIsOverride: boolean
  offsetFromStart: string
  startAt: string
  arrivalAt: string
}

type SortKey = 'from-start' | 'start-at' | 'arrival'

type FixedStartDisplayProps = {
  cueHeading?: ReactNode
  membersCount: number
  manualStartTime: string
  onManualStartTimeChange: (value: string) => void
  manualStartSeconds: number | null
  manualScheduleRows: FixedStartScheduleRow[]
}

export function FixedStartDisplay({
  cueHeading,
  membersCount,
  manualStartTime,
  onManualStartTimeChange,
  manualStartSeconds,
  manualScheduleRows,
}: FixedStartDisplayProps) {
  const prefersReducedMotion = useReducedMotion()
  const [manualStartDraft, setManualStartDraft] = useState(manualStartTime)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [sortKey, setSortKey] = useState<SortKey>('arrival')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    setManualStartDraft(manualStartTime)
  }, [manualStartTime])

  useEffect(() => {
    if (copyStatus === 'idle') return
    const timerId = window.setTimeout(() => setCopyStatus('idle'), 1800)
    return () => window.clearTimeout(timerId)
  }, [copyStatus])

  const handleCopySchedule = async () => {
    const text = sortedScheduleRows
      .map((row) => `${row.name} - ${row.startAt}`)
      .join('\n')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('success')
    } catch {
      setCopyStatus('error')
    }
  }
  const copyButtonText =
    copyStatus === 'success'
      ? 'Copied'
      : copyStatus === 'error'
        ? 'Copy failed'
        : 'Copy Start Times'
  const sortedScheduleRows = [...manualScheduleRows].sort((a, b) => {
    const left =
      sortKey === 'from-start'
        ? a.fromStartSeconds
        : sortKey === 'start-at'
          ? a.startAtTotalSeconds
          : a.arrivalTotalSeconds
    const right =
      sortKey === 'from-start'
        ? b.fromStartSeconds
        : sortKey === 'start-at'
          ? b.startAtTotalSeconds
          : b.arrivalTotalSeconds
    if (left !== right) {
      return sortDirection === 'asc' ? left - right : right - left
    }
    return a.order - b.order
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDirection === 'asc' ? ' ▲' : ' ▼'
  }
  const rowTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <>
      {cueHeading ? (
        <div className="mt-0 mb-1 text-center font-display text-xl font-semibold tracking-wide text-zinc-300">
          {cueHeading}
        </div>
      ) : null}
      <div className="mt-4 w-full max-w-2xl rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-4 shadow-inner sm:p-5 mx-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Manual Rally Starts
          </p>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                Fixed start
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={manualStartDraft}
                placeholder="HH:MM:SS"
                onChange={(e) => setManualStartDraft(e.target.value)}
                onBlur={(e) => onManualStartTimeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onManualStartTimeChange((e.target as HTMLInputElement).value)
                    ;(e.target as HTMLInputElement).blur()
                  }
                  if (e.key === 'Escape') {
                    setManualStartDraft(manualStartTime)
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                aria-label="Fixed start time in 24-hour format HH:MM:SS"
                className="h-8 w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-0 font-mono text-sm tabular-nums text-zinc-100 focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void handleCopySchedule()
              }}
              disabled={sortedScheduleRows.length === 0}
              className={`inline-flex h-12 items-center gap-2 rounded-lg border px-3 py-0 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                copyStatus === 'success'
                  ? 'border-emerald-400/70 bg-emerald-900/40 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-900/50'
                  : 'border-zinc-600 bg-zinc-900/80 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copyButtonText}</span>
            </button>
          </div>
        </div>
        {membersCount === 0 ? (
          <p className="py-6 text-center text-zinc-500">
            Add leads to the selected group to generate manual start times.
          </p>
        ) : manualStartSeconds === null ? (
          <p className="py-6 text-center text-zinc-500">
            Enter a valid fixed start time in HH:MM:SS.
          </p>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-2 py-2">Lead</th>
                    <th className="px-2 py-2 text-right">March</th>
                    <th className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('from-start')}
                        className="inline-flex items-center gap-1 text-inherit transition hover:text-zinc-300"
                      >
                        FROM START{sortIndicator('from-start')}
                      </button>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('start-at')}
                        className="inline-flex items-center gap-1 text-inherit transition hover:text-zinc-300"
                      >
                        START AT{sortIndicator('start-at')}
                      </button>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('arrival')}
                        className="inline-flex items-center gap-1 text-inherit transition hover:text-zinc-300"
                      >
                        ARRIVAL{sortIndicator('arrival')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <LayoutGroup id="manual-rally-start-rows">
                  <motion.tbody layout className="divide-y divide-zinc-800">
                    {sortedScheduleRows.map((row) => (
                    <motion.tr
                      key={row.leadId}
                      layout
                      transition={rowTransition}
                    >
                      <td className="px-2 py-2.5 text-zinc-200">{row.name}</td>
                      <td className="px-2 py-2.5 text-right">
                        <span
                          className={`font-mono tabular-nums ${
                            row.marchTimeIsOverride
                              ? 'rounded-md bg-amber-500/20 px-1.5 py-0.5 text-amber-200 ring-1 ring-amber-400/50'
                              : 'text-zinc-300'
                          }`}
                        >
                          {row.marchTimeUsed}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-zinc-300">
                        {row.offsetFromStart}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-amber-200">
                        {row.startAt}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular-nums text-emerald-200">
                        {row.arrivalAt}
                      </td>
                    </motion.tr>
                  ))}
                  </motion.tbody>
                </LayoutGroup>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
