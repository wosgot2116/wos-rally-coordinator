import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RallyGroupPanel } from './components/RallyGroupPanel'
import { RallyLeadList } from './components/RallyLeadList'
import { StageClock } from './components/StageClock'
import { moveIndex, orderLeadsForGroup } from './rally/leadListOps'
import {
  buildScriptEvents,
  computeDepartureRows,
  lastScriptSecond,
} from './rally/scriptEngine'
import {
  clearPersistedConfig,
  loadBootstrapConfig,
  writePersistedConfig,
} from './rally/persistedConfig'
import {
  createEmptyLead,
  createGroup,
  type RallyGroup,
  type RallyLeadEntry,
} from './rally/rallyTypes'

type RunState = 'idle' | 'running' | 'paused'

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms))
  const minutes = Math.floor(total / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const centis = Math.floor((total % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`
}

function App() {
  const [groups, setGroups] = useState<RallyGroup[]>(
    () => loadBootstrapConfig().groups,
  )
  const [selectedGroupId, setSelectedGroupId] = useState(
    () => loadBootstrapConfig().selectedGroupId,
  )
  const [leads, setLeads] = useState<RallyLeadEntry[]>(
    () => loadBootstrapConfig().leads,
  )
  const leadsRef = useRef(leads)
  leadsRef.current = leads

  const activeGroupId = useMemo(() => {
    if (groups.length === 0) return ''
    if (groups.some((g) => g.id === selectedGroupId)) return selectedGroupId
    return groups[0]!.id
  }, [groups, selectedGroupId])

  const selectedGroup = groups.find((g) => g.id === activeGroupId)

  const groupMembers = useMemo(() => {
    if (!activeGroupId || !selectedGroup) return []
    return orderLeadsForGroup(
      leads,
      activeGroupId,
      selectedGroup.memberOrderIds,
    )
  }, [leads, activeGroupId, selectedGroup])

  const lastScriptSecondIndex = useMemo(() => {
    if (!selectedGroup || groupMembers.length === 0) return -1
    const rows = computeDepartureRows(
      groupMembers,
      selectedGroup.targetArrivalGapSeconds,
    )
    return lastScriptSecond(buildScriptEvents(rows))
  }, [selectedGroup, groupMembers])

  const handleReorderGroupMembers = useCallback(
    (groupId: string, from: number, to: number) => {
      if (!groupId) return
      setGroups((prevGroups) => {
        const g = prevGroups.find((x) => x.id === groupId)
        if (!g) return prevGroups
        const ordered = orderLeadsForGroup(
          leadsRef.current,
          groupId,
          g.memberOrderIds,
        )
        const ids = ordered.map((l) => l.id)
        const nextIds = moveIndex(ids, from, to)
        return prevGroups.map((x) =>
          x.id === groupId ? { ...x, memberOrderIds: nextIds } : x,
        )
      })
    },
    [],
  )

  const handleUpdateLead = useCallback(
    (id: string, patch: Partial<Pick<RallyLeadEntry, 'name' | 'marchTimeSeconds'>>) => {
      setLeads((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      )
    },
    [],
  )

  const handleRemoveLead = useCallback((id: string) => {
    setLeads((prev) => prev.filter((r) => r.id !== id))
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        memberOrderIds: g.memberOrderIds.filter((mid) => mid !== id),
      })),
    )
  }, [])

  const handleAddLead = useCallback(() => {
    setLeads((prev) => [...prev, createEmptyLead()])
  }, [])

  const handleAssignLead = useCallback((leadId: string, groupId: string) => {
    setLeads((prev) =>
      prev.map((r) =>
        r.id === leadId && !r.groupIds.includes(groupId)
          ? { ...r, groupIds: [...r.groupIds, groupId] }
          : r,
      ),
    )
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        if (g.memberOrderIds.includes(leadId)) return g
        return { ...g, memberOrderIds: [...g.memberOrderIds, leadId] }
      }),
    )
  }, [])

  const handleReturnToSource = useCallback((leadId: string, groupId: string) => {
    setLeads((prev) =>
      prev.map((r) =>
        r.id === leadId
          ? { ...r, groupIds: r.groupIds.filter((id) => id !== groupId) }
          : r,
      ),
    )
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              memberOrderIds: g.memberOrderIds.filter((id) => id !== leadId),
            }
          : g,
      ),
    )
  }, [])

  const handleAddGroup = useCallback(() => {
    setGroups((prev) => [...prev, createGroup(`Group ${prev.length + 1}`)])
  }, [])

  const handleRenameGroup = useCallback((groupId: string, label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, label: trimmed } : g)),
    )
  }, [])

  const handleSetGroupTargetArrivalGap = useCallback(
    (groupId: string, gapSeconds: number) => {
      const n = Math.max(
        0,
        Math.floor(Number.isFinite(gapSeconds) ? gapSeconds : 0),
      )
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, targetArrivalGapSeconds: n } : g,
        ),
      )
    },
    [],
  )

  const [runState, setRunState] = useState<RunState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const baseMsRef = useRef(0)
  const anchorRef = useRef(0)
  /** Elapsed ms at which to auto-reset: 3s after the last script second ends. */
  const scriptAutoResetAtMsRef = useRef<number | null>(null)

  useEffect(() => {
    if (lastScriptSecondIndex < 0) {
      scriptAutoResetAtMsRef.current = null
      return
    }
    scriptAutoResetAtMsRef.current =
      (lastScriptSecondIndex + 1) * 1000 + 3000
  }, [lastScriptSecondIndex])

  const reset = useCallback(() => {
    setRunState('idle')
    baseMsRef.current = 0
    setElapsedMs(0)
  }, [])

  useEffect(() => {
    writePersistedConfig({
      version: 1,
      groups,
      leads,
      selectedGroupId,
    })
  }, [groups, leads, selectedGroupId])

  const clearStoredConfig = useCallback(() => {
    clearPersistedConfig()
    setGroups([createGroup('Group 1')])
    setLeads([])
    setSelectedGroupId('')
    reset()
  }, [reset])

  useEffect(() => {
    if (runState !== 'running') return

    anchorRef.current = performance.now()
    let frame = 0

    const step = () => {
      const next = baseMsRef.current + (performance.now() - anchorRef.current)
      const deadline = scriptAutoResetAtMsRef.current
      if (deadline !== null && next >= deadline) {
        reset()
        return
      }
      setElapsedMs(next)
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [runState, reset])

  const start = useCallback(() => {
    if (runState === 'running') return
    setRunState('running')
  }, [runState])

  const pause = useCallback(() => {
    if (runState !== 'running') return
    const now = performance.now()
    baseMsRef.current += now - anchorRef.current
    setElapsedMs(baseMsRef.current)
    setRunState('paused')
  }, [runState])

  const primaryAction = runState === 'running' ? pause : start
  const primaryLabel = runState === 'running' ? 'Pause' : 'Start'

  const stageButtons = (
    <>
      <button
        type="button"
        onClick={primaryAction}
        className="min-w-40 rounded-xl bg-amber-500 px-8 py-3 text-base font-semibold text-zinc-950 shadow-sm transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={reset}
        disabled={runState === 'idle' && elapsedMs === 0}
        className="min-w-40 rounded-xl border border-zinc-600 bg-zinc-900/80 px-8 py-3 text-base font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-40"
      >
        Reset
      </button>
    </>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium tracking-wide text-amber-400/90">
              Whiteout Survival · State 2086
            </p>
            <h1 className="mt-1 font-display text-lg font-semibold text-zinc-100">
              Rally time coordinator
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Run the stage clock, read the caller script for the selected group, and
              manage the roster and rally groups below.
            </p>
          </div>
          <button
            type="button"
            onClick={clearStoredConfig}
            className="shrink-0 self-end rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-red-500/60 hover:bg-red-950/40 hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:self-start"
          >
            Clear saved roster and groups
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-6 py-8">
        <div className="flex w-full flex-col items-center border-b border-zinc-800/80 pb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Stage clock
          </p>
          <div
            className="mt-2 font-mono text-xl font-medium tabular-nums tracking-tight text-zinc-500 sm:text-2xl"
            aria-live="polite"
          >
            {formatElapsed(elapsedMs)}
          </div>

          {selectedGroup ? (
            <>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Caller script · {selectedGroup.label}
              </p>
              <StageClock
                members={groupMembers}
                targetArrivalGapSeconds={selectedGroup.targetArrivalGapSeconds}
                elapsedMs={elapsedMs}
                stageActions={
                  <div className="flex flex-wrap justify-center gap-4">
                    {stageButtons}
                  </div>
                }
              />
            </>
          ) : (
            <div className="mt-8 flex flex-wrap justify-center gap-4">{stageButtons}</div>
          )}
        </div>

        <div className="flex min-w-0 w-full flex-1 flex-col gap-6 md:flex-row md:items-start md:gap-6">
          <div className="min-w-0 flex-1 md:min-w-0 md:basis-0">
            <RallyLeadList
              rows={leads}
              groups={groups}
              stageClockRunning={runState !== 'idle'}
              onAssignLead={handleAssignLead}
              onUpdateLead={handleUpdateLead}
              onRemoveLead={handleRemoveLead}
              onAddLead={handleAddLead}
            />
          </div>
          <div className="min-w-0 flex-1 md:min-w-0 md:basis-0">
            <RallyGroupPanel
              groups={groups}
              selectedGroupId={activeGroupId}
              stageClockRunning={runState !== 'idle'}
              onSelectGroup={setSelectedGroupId}
              onAddGroup={handleAddGroup}
              onRenameGroup={handleRenameGroup}
              onSetGroupTargetArrivalGap={handleSetGroupTargetArrivalGap}
              members={groupMembers}
              onAssignLead={handleAssignLead}
              onReturnToSource={(leadId) =>
                handleReturnToSource(leadId, activeGroupId)
              }
              onReorderMembers={(from, to) =>
                handleReorderGroupMembers(activeGroupId, from, to)
              }
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
