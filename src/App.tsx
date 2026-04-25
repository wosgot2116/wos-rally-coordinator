import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import woodblockSound from './assets/woodblock.mp3'
import { MetronomeModal } from './components/MetronomeModal'
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
type DisplayMode = 'caller-script' | 'manual-starts'
const MIN_BPM = 30
const MAX_BPM = 300
const UI_SETTINGS_STORAGE_KEY = 'wos-rally-timer:ui-settings:v1'

type PersistedUiSettings = {
  displayMode: DisplayMode
  manualStartTime: string
  metronomeRunning: boolean
  metronomeBpm: number
  metronomeOnlyWhenScriptRunning: boolean
}

function loadUiSettings(): PersistedUiSettings | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(UI_SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const data = parsed as Record<string, unknown>
    if (
      (data.displayMode !== 'caller-script' && data.displayMode !== 'manual-starts') ||
      typeof data.manualStartTime !== 'string' ||
      typeof data.metronomeRunning !== 'boolean' ||
      typeof data.metronomeBpm !== 'number' ||
      typeof data.metronomeOnlyWhenScriptRunning !== 'boolean'
    ) {
      return null
    }
    return {
      displayMode: data.displayMode,
      manualStartTime: normalizeManualStartTime(data.manualStartTime),
      metronomeRunning: data.metronomeRunning,
      metronomeBpm: clampBpm(data.metronomeBpm),
      metronomeOnlyWhenScriptRunning: data.metronomeOnlyWhenScriptRunning,
    }
  } catch {
    return null
  }
}

function writeUiSettings(settings: PersistedUiSettings): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore storage failures */
  }
}

function normalizeManualStartTime(value: string): string {
  const rawParts = value.split(':')
  const padded =
    rawParts.length === 2 ? [...rawParts, '00'] : rawParts
  const parts = padded.map((part) => Number.parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return '00:00:00'
  }
  const [hours, minutes, seconds] = parts
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return '00:00:00'
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return MIN_BPM
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)))
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms))
  const minutes = Math.floor(total / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const centis = Math.floor((total % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`
}

function App() {
  const uiBootstrap = useMemo(() => loadUiSettings(), [])
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

  const groupMembersForScript = useMemo(() => {
    if (!selectedGroup) return []
    return groupMembers.map((lead) => {
      const override =
        selectedGroup.marchTimeOverrideSecondsByLeadId[lead.id]
      if (override === undefined) return lead
      return { ...lead, marchTimeSeconds: override }
    })
  }, [groupMembers, selectedGroup])

  const lastScriptSecondIndex = useMemo(() => {
    if (!selectedGroup || groupMembers.length === 0) return -1
    const rows = computeDepartureRows(
      groupMembersForScript,
      selectedGroup.targetArrivalGapSeconds,
    )
    return lastScriptSecond(buildScriptEvents(rows))
  }, [selectedGroup, groupMembersForScript])

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
        marchTimeOverrideSecondsByLeadId: Object.fromEntries(
          Object.entries(g.marchTimeOverrideSecondsByLeadId).filter(
            ([leadId]) => leadId !== id,
          ),
        ),
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
              marchTimeOverrideSecondsByLeadId: Object.fromEntries(
                Object.entries(g.marchTimeOverrideSecondsByLeadId).filter(
                  ([id]) => id !== leadId,
                ),
              ),
            }
          : g,
      ),
    )
  }, [])

  const handleAddGroup = useCallback(() => {
    setGroups((prev) => [...prev, createGroup(`Group ${prev.length + 1}`)])
  }, [])

  const handleDeleteGroup = useCallback((groupId: string) => {
    setGroups((prevGroups) => {
      if (!prevGroups.some((g) => g.id === groupId)) return prevGroups
      const nextGroups = prevGroups.filter((g) => g.id !== groupId)
      setSelectedGroupId((prevSelectedId) => {
        if (prevSelectedId !== groupId) return prevSelectedId
        return nextGroups[0]?.id ?? ''
      })
      return nextGroups
    })
    setLeads((prevLeads) =>
      prevLeads.map((lead) => ({
        ...lead,
        groupIds: lead.groupIds.filter((id) => id !== groupId),
      })),
    )
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

  const handleSetGroupLeadMarchOverride = useCallback(
    (groupId: string, leadId: string, marchTimeSeconds: number | null) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g
          const nextOverrides = { ...g.marchTimeOverrideSecondsByLeadId }
          if (marchTimeSeconds === null) {
            delete nextOverrides[leadId]
          } else {
            nextOverrides[leadId] = Math.max(
              0,
              Math.floor(
                Number.isFinite(marchTimeSeconds) ? marchTimeSeconds : 0,
              ),
            )
          }
          return { ...g, marchTimeOverrideSecondsByLeadId: nextOverrides }
        }),
      )
    },
    [],
  )

  const [runState, setRunState] = useState<RunState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    () => uiBootstrap?.displayMode ?? 'caller-script',
  )
  const [manualStartTime, setManualStartTime] = useState(
    () => uiBootstrap?.manualStartTime ?? '00:00:00',
  )
  const [metronomeModalOpen, setMetronomeModalOpen] = useState(false)
  const [metronomeRunning, setMetronomeRunning] = useState(
    () => uiBootstrap?.metronomeRunning ?? false,
  )
  const [metronomeBpm, setMetronomeBpm] = useState(
    () => uiBootstrap?.metronomeBpm ?? 60,
  )
  const [metronomeOnlyWhenScriptRunning, setMetronomeOnlyWhenScriptRunning] =
    useState(() => uiBootstrap?.metronomeOnlyWhenScriptRunning ?? false)
  const [callerGroupMenuOpen, setCallerGroupMenuOpen] = useState(false)
  const callerGroupMenuRef = useRef<HTMLDivElement | null>(null)
  const metronomeAudioContextRef = useRef<AudioContext | null>(null)
  const metronomeBufferRef = useRef<AudioBuffer | null>(null)
  const metronomeLastTickPerfMsRef = useRef<number | null>(null)
  const metronomeIntervalIdRef = useRef<number | null>(null)
  const metronomeWasAudibleRef = useRef(false)
  const scriptSyncedToMetronomeRef = useRef(false)
  const scriptSyncBaseElapsedMsRef = useRef(0)
  const scriptSyncAnchorPerfMsRef = useRef(0)
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
    scriptSyncedToMetronomeRef.current = false
    scriptSyncBaseElapsedMsRef.current = 0
    scriptSyncAnchorPerfMsRef.current = 0
  }, [])

  useEffect(() => {
    writePersistedConfig({
      version: 1,
      groups,
      leads,
      selectedGroupId,
    })
  }, [groups, leads, selectedGroupId])

  useEffect(() => {
    writeUiSettings({
      displayMode,
      manualStartTime,
      metronomeRunning,
      metronomeBpm,
      metronomeOnlyWhenScriptRunning,
    })
  }, [
    displayMode,
    manualStartTime,
    metronomeRunning,
    metronomeBpm,
    metronomeOnlyWhenScriptRunning,
  ])

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
      const rawElapsed = baseMsRef.current + (performance.now() - anchorRef.current)
      const next =
        scriptSyncedToMetronomeRef.current && metronomeRunning
          ? scriptSyncBaseElapsedMsRef.current +
            Math.max(0, performance.now() - scriptSyncAnchorPerfMsRef.current)
          : rawElapsed
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
  }, [runState, reset, metronomeRunning])

  useEffect(() => {
    if (runState !== 'running') return
    if (metronomeRunning) return
    if (!scriptSyncedToMetronomeRef.current) return
    // When metronome stops mid-run, continue script in realtime from current point.
    scriptSyncedToMetronomeRef.current = false
    baseMsRef.current = elapsedMs
    anchorRef.current = performance.now()
  }, [metronomeRunning, runState, elapsedMs])

  const start = useCallback(() => {
    if (runState === 'running') return
    if (metronomeRunning) {
      const metronomeActivelyTicking = !metronomeOnlyWhenScriptRunning
      scriptSyncedToMetronomeRef.current = true
      scriptSyncBaseElapsedMsRef.current = baseMsRef.current
      scriptSyncAnchorPerfMsRef.current =
        metronomeActivelyTicking
          ? metronomeLastTickPerfMsRef.current ?? performance.now()
          : performance.now()
    } else {
      scriptSyncedToMetronomeRef.current = false
    }
    setRunState('running')
  }, [runState, metronomeRunning, metronomeOnlyWhenScriptRunning])

  const pause = useCallback(() => {
    if (runState !== 'running') return
    const now = performance.now()
    baseMsRef.current += now - anchorRef.current
    setElapsedMs(baseMsRef.current)
    setRunState('paused')
  }, [runState])

  const primaryAction = runState === 'running' ? pause : start
  const primaryLabel = runState === 'running' ? 'Pause' : 'Start'
  const handleChangeDisplayMode = useCallback(
    (mode: DisplayMode) => {
      setDisplayMode(mode)
      if (mode === 'manual-starts') {
        reset()
      }
    },
    [reset],
  )
  const handleManualStartTimeChange = useCallback((value: string) => {
    setManualStartTime(normalizeManualStartTime(value))
  }, [])

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

  const playMetronomeTick = useCallback(() => {
    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) return
    let context = metronomeAudioContextRef.current
    if (!context) {
      context = new AudioContextCtor()
      metronomeAudioContextRef.current = context
    }
    if (context.state === 'suspended') {
      void context.resume()
    }
    const tickBuffer = metronomeBufferRef.current
    if (!tickBuffer) return
    const source = context.createBufferSource()
    source.buffer = tickBuffer
    source.connect(context.destination)
    source.start()
  }, [])

  useEffect(() => {
    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) return
    const context =
      metronomeAudioContextRef.current ?? new AudioContextCtor()
    metronomeAudioContextRef.current = context
    let active = true

    const loadBuffer = async () => {
      try {
        const response = await fetch(woodblockSound)
        const arrayBuffer = await response.arrayBuffer()
        const decoded = await context.decodeAudioData(arrayBuffer.slice(0))
        if (!active) return
        metronomeBufferRef.current = decoded
      } catch {
        metronomeBufferRef.current = null
      }
    }

    void loadBuffer()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const metronomeScriptGateOpen =
      !metronomeOnlyWhenScriptRunning || runState === 'running'
    const shouldPlayMetronome = metronomeRunning && metronomeScriptGateOpen
    const becameAudible = shouldPlayMetronome && !metronomeWasAudibleRef.current

    if (!shouldPlayMetronome) {
      if (metronomeIntervalIdRef.current !== null) {
        window.clearInterval(metronomeIntervalIdRef.current)
        metronomeIntervalIdRef.current = null
      }
      metronomeWasAudibleRef.current = false
      return
    }

    const intervalMs = 60000 / metronomeBpm
    if (metronomeIntervalIdRef.current !== null) {
      window.clearInterval(metronomeIntervalIdRef.current)
      metronomeIntervalIdRef.current = null
    }
    if (becameAudible) {
      metronomeLastTickPerfMsRef.current = performance.now()
      playMetronomeTick()
    }
    metronomeIntervalIdRef.current = window.setInterval(() => {
      metronomeLastTickPerfMsRef.current = performance.now()
      playMetronomeTick()
    }, intervalMs)
    metronomeWasAudibleRef.current = true
  }, [
    metronomeRunning,
    metronomeBpm,
    metronomeOnlyWhenScriptRunning,
    metronomeOnlyWhenScriptRunning ? runState : null,
    playMetronomeTick,
  ])

  useEffect(() => {
    return () => {
      if (metronomeIntervalIdRef.current !== null) {
        window.clearInterval(metronomeIntervalIdRef.current)
        metronomeIntervalIdRef.current = null
      }
      metronomeWasAudibleRef.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (metronomeAudioContextRef.current) {
        void metronomeAudioContextRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const menuRoot = callerGroupMenuRef.current
      if (!menuRoot) return
      if (!menuRoot.contains(event.target as Node)) {
        setCallerGroupMenuOpen(false)
      }
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCallerGroupMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  const isGroupSelectionLocked = runState !== 'idle'
  const callerScriptHeading: ReactNode = selectedGroup ? (
    <span className="inline-flex items-center gap-2">
      <span>{displayMode === 'caller-script' ? 'Caller Script' : 'Manual Start Schedule'}</span>
      <span className="text-zinc-500">-</span>
      <div ref={callerGroupMenuRef} className="relative inline-block text-left">
        <button
          type="button"
          disabled={isGroupSelectionLocked}
          onClick={() => setCallerGroupMenuOpen((open) => !open)}
          title={
            isGroupSelectionLocked
              ? 'Reset the stage clock to change group'
              : 'Select group'
          }
          aria-haspopup="menu"
          aria-expanded={callerGroupMenuOpen}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-amber-300 transition hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {selectedGroup.label}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`transition-transform ${callerGroupMenuOpen ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {callerGroupMenuOpen && !isGroupSelectionLocked ? (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 min-w-[11rem] overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-lg"
          >
            {groups.map((group) => {
              const isActive = group.id === activeGroupId
              return (
                <button
                  key={group.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    setSelectedGroupId(group.id)
                    setCallerGroupMenuOpen(false)
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {group.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </span>
  ) : (
    displayMode === 'caller-script' ? 'Caller Script' : 'Manual Start Schedule'
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
              Rally Tools
            </h1>
          </div>
          <div className="flex shrink-0 self-end sm:self-start">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
                <span className="text-xs uppercase tracking-wide text-zinc-500">
                  Mode
                </span>
                <select
                  value={displayMode}
                  onChange={(e) =>
                    handleChangeDisplayMode(e.target.value as DisplayMode)
                  }
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                >
                  <option value="caller-script">Caller Script</option>
                  <option value="manual-starts">Manual Starts</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setMetronomeModalOpen(true)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                  metronomeRunning
                    ? 'border-emerald-400/70 bg-emerald-900/40 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-900/50'
                    : 'border-zinc-600 bg-zinc-900/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                }`}
              >
                Metronome {metronomeRunning ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={clearStoredConfig}
                className="rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-red-500/60 hover:bg-red-950/40 hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                Clear All Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-6 py-8">
        <div className="w-full border-b border-zinc-800/80 pb-12">
          <StageClock
            members={groupMembersForScript}
            targetArrivalGapSeconds={selectedGroup?.targetArrivalGapSeconds ?? 0}
            displayMode={displayMode}
            manualStartTime={manualStartTime}
            onManualStartTimeChange={handleManualStartTimeChange}
            marchTimeOverrideSecondsByLeadId={
              selectedGroup?.marchTimeOverrideSecondsByLeadId ?? {}
            }
            elapsedMs={elapsedMs}
            cueHeading={callerScriptHeading}
            stageActions={
              displayMode === 'caller-script' ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Stage clock
                  </p>
                  <div
                    className="mt-2 font-mono text-xl font-medium tabular-nums tracking-tight text-zinc-500 sm:text-2xl"
                    aria-live="polite"
                  >
                    {formatElapsed(elapsedMs)}
                  </div>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    {stageButtons}
                  </div>
                </div>
              ) : null
            }
          />
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
              onDeleteGroup={handleDeleteGroup}
              onRenameGroup={handleRenameGroup}
              onSetGroupTargetArrivalGap={handleSetGroupTargetArrivalGap}
              onSetGroupLeadMarchOverride={handleSetGroupLeadMarchOverride}
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

      <MetronomeModal
        isOpen={metronomeModalOpen}
        isRunning={metronomeRunning}
        beatsPerMinute={metronomeBpm}
        onlyPlayWhenScriptRunning={metronomeOnlyWhenScriptRunning}
        onClose={() => setMetronomeModalOpen(false)}
        onStart={() => setMetronomeRunning(true)}
        onStop={() => setMetronomeRunning(false)}
        onChangeBeatsPerMinute={(value) =>
          setMetronomeBpm(clampBpm(value))
        }
        onToggleOnlyPlayWhenScriptRunning={setMetronomeOnlyWhenScriptRunning}
      />
    </div>
  )
}

export default App
