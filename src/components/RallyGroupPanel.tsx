import { useCallback, useEffect, useRef, useState } from 'react'
import { DND_LEAD_ID_MIME, DND_REORDER_INDEX_MIME } from '../rally/dndMimes'
import { formatSecondsAsMmSs } from '../rally/timeMmSs'
import type { RallyGroup, RallyLeadEntry } from '../rally/rallyTypes'

const UUID_RE =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

/** Pixels of movement before treating as a touch drag (avoids blocking taps). */
const TOUCH_REORDER_THRESHOLD_PX = 12

function MemberReorderDragHandle({
  rowIndex,
  onDragStart,
  onDragEnd,
  onTouchPosition,
  onTouchFinish,
  disabled,
}: {
  rowIndex: number
  onDragStart: () => void
  onDragEnd: () => void
  onTouchPosition: (clientX: number, clientY: number) => void
  onTouchFinish: (didDrag: boolean) => void
  disabled: boolean
}) {
  if (disabled) {
    return (
      <div
        title="Reset the stage clock to reorder"
        className="inline-flex cursor-not-allowed touch-none select-none rounded px-1 py-2 text-zinc-600 opacity-50"
        aria-hidden
      >
        <svg
          width="14"
          height="16"
          viewBox="0 0 14 16"
          fill="currentColor"
          className="pointer-events-none"
          aria-hidden
        >
          <circle cx="4" cy="3.5" r="1.35" />
          <circle cx="10" cy="3.5" r="1.35" />
          <circle cx="4" cy="8" r="1.35" />
          <circle cx="10" cy="8" r="1.35" />
          <circle cx="4" cy="12.5" r="1.35" />
          <circle cx="10" cy="12.5" r="1.35" />
        </svg>
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_REORDER_INDEX_MIME, String(rowIndex))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onTouchStart={(e) => {
        if (disabled || e.touches.length !== 1) return
        const t0 = e.touches[0]
        const startX = t0.clientX
        const startY = t0.clientY
        let armedDrag = false

        const onMove = (ev: TouchEvent) => {
          if (ev.touches.length !== 1) return
          const t = ev.touches[0]
          const dx = t.clientX - startX
          const dy = t.clientY - startY
          if (dx * dx + dy * dy < TOUCH_REORDER_THRESHOLD_PX ** 2) return
          if (!armedDrag) {
            armedDrag = true
            onDragStart()
          }
          ev.preventDefault()
          onTouchPosition(t.clientX, t.clientY)
        }

        const onEnd = (ev: TouchEvent) => {
          window.removeEventListener('touchmove', onMove)
          window.removeEventListener('touchend', onEnd)
          window.removeEventListener('touchcancel', onEnd)
          if (armedDrag && ev.changedTouches[0]) {
            const t = ev.changedTouches[0]
            onTouchPosition(t.clientX, t.clientY)
          }
          onTouchFinish(armedDrag)
        }

        window.addEventListener('touchmove', onMove, { passive: false })
        window.addEventListener('touchend', onEnd)
        window.addEventListener('touchcancel', onEnd)
      }}
      title="Drag to reorder in this group"
      className="inline-flex cursor-grab touch-none select-none rounded px-1 py-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
      role="button"
      tabIndex={0}
      aria-label="Drag to reorder lead in this group"
    >
      <svg
        width="14"
        height="16"
        viewBox="0 0 14 16"
        fill="currentColor"
        className="pointer-events-none"
        aria-hidden
      >
        <circle cx="4" cy="3.5" r="1.35" />
        <circle cx="10" cy="3.5" r="1.35" />
        <circle cx="4" cy="8" r="1.35" />
        <circle cx="10" cy="8" r="1.35" />
        <circle cx="4" cy="12.5" r="1.35" />
        <circle cx="10" cy="12.5" r="1.35" />
      </svg>
    </div>
  )
}

type RallyGroupPanelProps = {
  groups: RallyGroup[]
  selectedGroupId: string
  /** When true, group controls are disabled until the stage clock is reset. */
  stageClockRunning: boolean
  onSelectGroup: (groupId: string) => void
  onAddGroup: () => void
  onRenameGroup: (groupId: string, label: string) => void
  onSetGroupTargetArrivalGap: (groupId: string, gapSeconds: number) => void
  members: RallyLeadEntry[]
  onAssignLead: (leadId: string, groupId: string) => void
  onReturnToSource: (leadId: string) => void
  onReorderMembers: (fromIndex: number, toIndex: number) => void
}

export function RallyGroupPanel({
  groups,
  selectedGroupId,
  stageClockRunning,
  onSelectGroup,
  onAddGroup,
  onRenameGroup,
  onSetGroupTargetArrivalGap,
  members,
  onAssignLead,
  onReturnToSource,
  onReorderMembers,
}: RallyGroupPanelProps) {
  const panelLocked = stageClockRunning
  const [dropActive, setDropActive] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragFromIndexRef = useRef<number | null>(null)
  const touchDropIndexRef = useRef<number | null>(null)

  const endHighlight = useCallback(() => {
    setDropActive(false)
  }, [])

  const endMemberDrag = useCallback(() => {
    dragFromIndexRef.current = null
    touchDropIndexRef.current = null
    setDragFromIndex(null)
    setDragOverIndex(null)
  }, [])

  const updateTouchDropHighlight = useCallback(
    (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY)
      if (!el) {
        touchDropIndexRef.current = null
        setDragOverIndex(null)
        return
      }
      const row = el.closest('[data-member-row-index]')
      if (!row || !(row instanceof HTMLElement)) {
        touchDropIndexRef.current = null
        setDragOverIndex(null)
        return
      }
      const raw = row.getAttribute('data-member-row-index')
      const idx = raw === null ? NaN : Number.parseInt(raw, 10)
      if (
        !Number.isFinite(idx) ||
        idx < 0 ||
        idx >= members.length
      ) {
        touchDropIndexRef.current = null
        setDragOverIndex(null)
        return
      }
      touchDropIndexRef.current = idx
      setDragOverIndex(idx)
    },
    [members.length],
  )

  const finishTouchReorder = useCallback(
    (didDrag: boolean) => {
      if (didDrag) {
        const from = dragFromIndexRef.current
        const to = touchDropIndexRef.current
        if (
          from !== null &&
          to !== null &&
          from !== to &&
          from >= 0 &&
          to >= 0 &&
          from < members.length &&
          to < members.length
        ) {
          onReorderMembers(from, to)
        }
      }
      endMemberDrag()
    },
    [endMemberDrag, members.length, onReorderMembers],
  )

  const hasLeadPayload = (dt: DataTransfer) =>
    dt.types.includes(DND_LEAD_ID_MIME)

  const editingTargetId =
    editingGroupId && groups.some((g) => g.id === editingGroupId)
      ? editingGroupId
      : null

  const startRename = useCallback(
    (g: RallyGroup) => {
      if (panelLocked) return
      onSelectGroup(g.id)
      setEditingGroupId(g.id)
      setRenameDraft(g.label)
    },
    [onSelectGroup, panelLocked],
  )

  useEffect(() => {
    if (!panelLocked) return
    setEditingGroupId(null)
    setRenameDraft('')
    setDropActive(false)
    dragFromIndexRef.current = null
    touchDropIndexRef.current = null
    setDragFromIndex(null)
    setDragOverIndex(null)
  }, [panelLocked])

  const commitRename = useCallback(() => {
    if (!editingGroupId) return
    const group = groups.find((x) => x.id === editingGroupId)
    const trimmed = renameDraft.trim()
    const next = trimmed || group?.label
    if (next && next !== group?.label) {
      onRenameGroup(editingGroupId, next)
    }
    setEditingGroupId(null)
  }, [editingGroupId, renameDraft, groups, onRenameGroup])

  const cancelRename = useCallback(() => {
    setEditingGroupId(null)
  }, [])

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  return (
    <section
      className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-sm"
      aria-labelledby="rally-groups-heading"
    >
      <div className="border-b border-zinc-800 px-4 py-3 sm:px-5">
        <h2
          id="rally-groups-heading"
          className="text-base font-semibold text-zinc-100"
        >
          Rally groups
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Pick a tab, drag leads from the roster into the drop area,
          then use the dot grip to reorder members. Rename with the pencil or
          double-click a tab. Group controls lock while the stage clock is active.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-2 sm:px-5">
        {groups.map((g) => {
          const selected = g.id === selectedGroupId
          const editing = editingTargetId === g.id

          if (editing) {
            return (
              <div
                key={g.id}
                className="inline-flex min-w-[10rem] items-center rounded-lg border border-amber-500 bg-zinc-950 px-1 py-0.5 shadow-sm"
              >
                <input
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                  }}
                  autoFocus
                  readOnly={panelLocked}
                  aria-label="Group name"
                  className="w-full min-w-[8rem] rounded-md border-0 bg-transparent px-2 py-1.5 text-sm font-semibold text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 read-only:cursor-not-allowed read-only:opacity-70"
                />
              </div>
            )
          }

          return (
            <div
              key={g.id}
              className={`inline-flex items-stretch overflow-hidden rounded-lg border text-sm font-semibold transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-amber-300 ${
                selected
                  ? 'border-amber-400 shadow-sm'
                  : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={panelLocked}
                onClick={() => onSelectGroup(g.id)}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  startRename(g)
                }}
                title={
                  panelLocked
                    ? 'Reset the stage clock to change group'
                    : 'Double-click to rename'
                }
                className={`px-3 py-1.5 transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {g.label}
              </button>
              <button
                type="button"
                disabled={panelLocked}
                onClick={(e) => {
                  e.preventDefault()
                  startRename(g)
                }}
                aria-label={`Rename ${g.label}`}
                title={
                  panelLocked
                    ? 'Reset the stage clock to rename'
                    : 'Rename group'
                }
                className={`border-l px-2 transition focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? 'border-amber-600/40 bg-amber-500 text-zinc-950 hover:bg-amber-400'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
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
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>
          )
        })}
        <button
          type="button"
          disabled={panelLocked}
          onClick={onAddGroup}
          title={
            panelLocked
              ? 'Reset the stage clock to add a group'
              : undefined
          }
          className="rounded-lg border border-dashed border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add group
        </button>
      </div>

      {selectedGroup ? (
        <div className="border-b border-zinc-800 bg-zinc-900/35 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <label
                htmlFor={`target-arrival-gap-${selectedGroup.id}`}
                className="text-sm font-medium text-zinc-200"
              >
                Target arrival gap
              </label>
              <p className="mt-0.5 max-w-xl text-xs leading-snug text-zinc-500">
                Extra seconds between each lead&apos;s target fort arrival in list
                order (0 = same arrival time; longer march times are called out
                first). Each next lead&apos;s arrival goal is this many seconds after
                the previous. Default is 0.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                key={`${selectedGroup.id}-${selectedGroup.targetArrivalGapSeconds}`}
                id={`target-arrival-gap-${selectedGroup.id}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={selectedGroup.targetArrivalGapSeconds}
                disabled={panelLocked}
                title={
                  panelLocked
                    ? 'Reset the stage clock to edit'
                    : undefined
                }
                onBlur={(e) => {
                  if (panelLocked) return
                  const v = Math.max(
                    0,
                    Math.floor(Number.parseInt(e.target.value, 10) || 0),
                  )
                  if (v !== selectedGroup.targetArrivalGapSeconds) {
                    onSetGroupTargetArrivalGap(selectedGroup.id, v)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                className="w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-right font-mono text-sm tabular-nums text-zinc-100 focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="pb-2 text-xs font-medium text-zinc-500">sec</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="p-4 sm:p-5">
        <div
          role="tabpanel"
          aria-label="Active group drop zone"
          className={`rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
            dropActive
              ? 'border-amber-500/80 bg-amber-500/10'
              : 'border-zinc-700 bg-zinc-950/40'
          } ${panelLocked ? 'opacity-70' : ''}`}
          onDragOver={(e) => {
            if (panelLocked) return
            if (!hasLeadPayload(e.dataTransfer)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropActive(true)
          }}
          onDragLeave={(e) => {
            if (panelLocked) return
            const next = e.relatedTarget as Node | null
            if (next && e.currentTarget.contains(next)) return
            setDropActive(false)
          }}
          onDrop={(e) => {
            if (panelLocked) return
            e.preventDefault()
            endHighlight()
            let id = e.dataTransfer.getData(DND_LEAD_ID_MIME)
            if (!id) {
              const plain = e.dataTransfer.getData('text/plain').trim()
              if (UUID_RE.test(plain)) id = plain
            }
            if (!id) return
            onAssignLead(id, selectedGroupId)
          }}
        >
          <p className="text-center text-sm text-zinc-500">
            {panelLocked ? (
              <>
                Drop zone locked while the stage clock is active. Reset to assign
                leads.
              </>
            ) : (
              <>
                Drop leads here for{' '}
                <span className="font-medium text-zinc-300">
                  {groups.find((g) => g.id === selectedGroupId)?.label ?? 'this group'}
                </span>
                .
              </>
            )}
          </p>

          {members.length === 0 ? (
            <p className="mt-3 text-center text-xs text-zinc-600">
              No leads in this group yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/60">
              {members.map((m, index) => (
                <li
                  key={m.id}
                  data-member-row-index={index}
                  className={`flex flex-wrap items-center gap-2 px-2 py-2 transition-colors sm:px-3 ${
                    dragFromIndex === index ? 'opacity-40' : ''
                  } ${
                    dragOverIndex === index &&
                    dragFromIndex !== null &&
                    dragFromIndex !== index
                      ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/35'
                      : ''
                  }`}
                  onDragOver={(e) => {
                    if (panelLocked) return
                    if (hasLeadPayload(e.dataTransfer)) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDropActive(true)
                      return
                    }
                    if (!e.dataTransfer.types.includes(DND_REORDER_INDEX_MIME)) {
                      return
                    }
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragFromIndexRef.current !== null) {
                      setDragOverIndex(index)
                    }
                  }}
                  onDragLeave={(e) => {
                    if (panelLocked) return
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return
                    setDragOverIndex((cur) => (cur === index ? null : cur))
                  }}
                  onDrop={(e) => {
                    if (panelLocked) return
                    if (hasLeadPayload(e.dataTransfer)) {
                      e.preventDefault()
                      e.stopPropagation()
                      endHighlight()
                      let id = e.dataTransfer.getData(DND_LEAD_ID_MIME)
                      if (!id) {
                        const plain = e.dataTransfer.getData('text/plain').trim()
                        if (UUID_RE.test(plain)) id = plain
                      }
                      if (id) {
                        onAssignLead(id, selectedGroupId)
                      }
                      return
                    }
                    e.preventDefault()
                    e.stopPropagation()
                    const fromStr = e.dataTransfer.getData(DND_REORDER_INDEX_MIME)
                    if (fromStr === '') {
                      endMemberDrag()
                      return
                    }
                    const from = Number.parseInt(fromStr, 10)
                    if (
                      !Number.isFinite(from) ||
                      from < 0 ||
                      from >= members.length
                    ) {
                      endMemberDrag()
                      return
                    }
                    onReorderMembers(from, index)
                    endMemberDrag()
                  }}
                >
                  <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <MemberReorderDragHandle
                        rowIndex={index}
                        disabled={panelLocked}
                        onDragStart={() => {
                          dragFromIndexRef.current = index
                          setDragFromIndex(index)
                        }}
                        onDragEnd={endMemberDrag}
                        onTouchPosition={updateTouchDropHighlight}
                        onTouchFinish={finishTouchReorder}
                      />
                      <span className="min-w-0 truncate font-medium text-zinc-200">
                        {m.name.trim() || '—'}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm tabular-nums text-zinc-400">
                        {formatSecondsAsMmSs(m.marchTimeSeconds)}
                      </span>
                      <button
                        type="button"
                        disabled={panelLocked}
                        onClick={() => onReturnToSource(m.id)}
                        title={
                          panelLocked
                            ? 'Reset the stage clock to remove from group'
                            : undefined
                        }
                        className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
