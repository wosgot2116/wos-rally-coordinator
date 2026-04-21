import { useState } from 'react'
import { DND_LEAD_ID_MIME } from '../rally/dndMimes'
import type { RallyGroup, RallyLeadEntry } from '../rally/rallyTypes'
import { formatSecondsAsMmSs, parseMmSsToSeconds } from '../rally/timeMmSs'

function AssignToGroupDragHandle({ leadId }: { leadId: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_LEAD_ID_MIME, leadId)
        e.dataTransfer.setData('text/plain', leadId)
        e.dataTransfer.effectAllowed = 'move'
      }}
      title="Drag into the group drop zone"
      className="hidden cursor-grab touch-none select-none rounded px-2 py-2 text-amber-500/90 hover:bg-zinc-800 hover:text-amber-400 active:cursor-grabbing sm:inline-flex"
      role="button"
      tabIndex={0}
      aria-label="Drag lead into the selected rally group"
    >
      <svg
        width="18"
        height="16"
        viewBox="0 0 18 16"
        fill="currentColor"
        className="pointer-events-none"
        aria-hidden
      >
        <path d="M2 2h8v2H4v10H2V2zm6 6h8v8H8V8zm2 2v4h4v-4h-4z" />
      </svg>
    </div>
  )
}

export type { RallyLeadEntry } from '../rally/rallyTypes'

function groupLabels(groups: RallyGroup[], groupIds: string[]): string[] {
  if (groupIds.length === 0) return []
  return groupIds.map((groupId) => {
    return groups.find((g) => g.id === groupId)?.label ?? 'Unknown group'
  })
}

export type RallyLeadListProps = {
  rows: RallyLeadEntry[]
  groups: RallyGroup[]
  /** When true, roster controls are disabled until the stage clock is reset. */
  stageClockRunning: boolean
  onAssignLead: (leadId: string, groupId: string) => void
  onUpdateLead: (
    id: string,
    patch: Partial<Pick<RallyLeadEntry, 'name' | 'marchTimeSeconds'>>,
  ) => void
  onRemoveLead: (id: string) => void
  onAddLead: () => void
}

export function RallyLeadList({
  rows,
  groups,
  stageClockRunning,
  onAssignLead,
  onUpdateLead,
  onRemoveLead,
  onAddLead,
}: RallyLeadListProps) {
  const [timeDraftById, setTimeDraftById] = useState<Record<string, string>>({})
  const rosterLocked = stageClockRunning

  const timeDisplayValue = (row: RallyLeadEntry) =>
    timeDraftById[row.id] ?? formatSecondsAsMmSs(row.marchTimeSeconds)

  return (
    <section
      className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-sm"
      aria-labelledby="rally-roster-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
        <div>
          <h2
            id="rally-roster-heading"
            className="text-base font-semibold text-zinc-100"
          >
            Roster
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Edit names and march times for any row. Drag leads into a group on
            desktop, or use the Add-to-group dropdown on mobile. Player, march
            time, Add lead, and Remove are locked while the stage clock is active.
          </p>
        </div>
        <button
          type="button"
          disabled={rosterLocked}
          onClick={onAddLead}
          title={
            rosterLocked
              ? 'Reset the stage clock to add leads'
              : undefined
          }
          className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-500"
        >
          Add lead
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-2.5 sm:px-5">
                Player
              </th>
              <th scope="col" className="px-4 py-2.5 sm:px-5">
                Group
              </th>
              <th scope="col" className="px-4 py-2.5 sm:px-5">
                March Time
              </th>
              <th scope="col" className="w-px px-2 py-2.5 sm:px-3">
                <span className="sr-only">Assign to group</span>
              </th>
              <th scope="col" className="w-px px-4 py-2.5 sm:px-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-zinc-500 sm:px-5"
                >
                  No leads in the roster. Use &ldquo;Add lead&rdquo; to start,
                  then assign unassigned rows into a group tab.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const labels = groupLabels(groups, row.groupIds)
                const assigned = labels.length > 0
                const fieldClass =
                  'rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/80 disabled:text-zinc-500 disabled:opacity-80'

                return (
                  <tr
                    key={row.id}
                    className={`align-middle ${assigned ? 'bg-zinc-900/50' : ''}`}
                  >
                    <td className="px-4 py-2 sm:px-5">
                      <label className="sr-only" htmlFor={`name-${row.id}`}>
                        Player name
                      </label>
                      <input
                        id={`name-${row.id}`}
                        type="text"
                        value={row.name}
                        onChange={(e) =>
                          onUpdateLead(row.id, { name: e.target.value })
                        }
                        placeholder="Name or ID"
                        autoComplete="off"
                        disabled={rosterLocked}
                        title={
                          rosterLocked
                            ? 'Reset the stage clock to edit'
                            : undefined
                        }
                        className={`w-full min-w-[8rem] ${fieldClass}`}
                      />
                    </td>
                    <td className="px-4 py-2 sm:px-5">
                      {assigned ? (
                        <span className="inline-flex max-w-full items-center rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200/95">
                          <span className="truncate">{labels.join(', ')}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 sm:px-5">
                      <label className="sr-only" htmlFor={`time-${row.id}`}>
                        March time mm:ss
                      </label>
                      <input
                        id={`time-${row.id}`}
                        type="text"
                        inputMode="numeric"
                        value={timeDisplayValue(row)}
                        onChange={(e) => {
                          setTimeDraftById((d) => ({
                            ...d,
                            [row.id]: e.target.value,
                          }))
                        }}
                        onBlur={(e) => {
                          const raw = e.target.value
                          setTimeDraftById((d) => {
                            const next = { ...d }
                            delete next[row.id]
                            return next
                          })
                          const parsed = parseMmSsToSeconds(raw)
                          if (parsed !== null) {
                            onUpdateLead(row.id, { marchTimeSeconds: parsed })
                          }
                        }}
                        placeholder="mm:ss"
                        spellCheck={false}
                        disabled={rosterLocked}
                        title={
                          rosterLocked
                            ? 'Reset the stage clock to edit'
                            : undefined
                        }
                        className={`w-22 font-mono tabular-nums ${fieldClass}`}
                      />
                    </td>
                    <td className="w-px px-2 py-2 align-middle sm:px-3">
                      <label className="sr-only" htmlFor={`assign-group-${row.id}`}>
                        Assign to group
                      </label>
                      <select
                        id={`assign-group-${row.id}`}
                        disabled={rosterLocked}
                        defaultValue=""
                        onChange={(e) => {
                          const groupId = e.target.value
                          if (!groupId) return
                          onAssignLead(row.id, groupId)
                          e.currentTarget.value = ''
                        }}
                        className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
                        title={
                          rosterLocked
                            ? 'Reset the stage clock to assign'
                            : undefined
                        }
                      >
                        <option value="">Add to…</option>
                        {groups
                          .filter((g) => !row.groupIds.includes(g.id))
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label}
                            </option>
                          ))}
                      </select>
                      <AssignToGroupDragHandle leadId={row.id} />
                    </td>
                    <td className="px-4 py-2 sm:px-5">
                      <button
                        type="button"
                        disabled={rosterLocked}
                        onClick={() => {
                          onRemoveLead(row.id)
                          setTimeDraftById((d) => {
                            const next = { ...d }
                            delete next[row.id]
                            return next
                          })
                        }}
                        title={
                          rosterLocked
                            ? 'Reset the stage clock to remove leads'
                            : undefined
                        }
                        className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-red-900/80 hover:bg-red-950/40 hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-700 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
