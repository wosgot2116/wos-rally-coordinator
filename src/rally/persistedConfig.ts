import { createGroup, type RallyGroup, type RallyLeadEntry } from './rallyTypes'

const STORAGE_KEY = 'wos-rally-timer:config:v1'

export type PersistedConfig = {
  version: 1
  groups: RallyGroup[]
  leads: RallyLeadEntry[]
  selectedGroupId: string
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function normalizeGroup(raw: Record<string, unknown>): RallyGroup | null {
  if (typeof raw.id !== 'string' || typeof raw.label !== 'string') return null
  const gap =
    typeof raw.targetArrivalGapSeconds === 'number'
      ? raw.targetArrivalGapSeconds
      : typeof raw.arrivalOffsetSeconds === 'number'
        ? raw.arrivalOffsetSeconds
        : 0
  const orderRaw = raw.memberOrderIds
  const memberOrderIds = Array.isArray(orderRaw)
    ? orderRaw.filter((id): id is string => typeof id === 'string')
    : []
  const overridesRaw = raw.marchTimeOverrideSecondsByLeadId
  const marchTimeOverrideSecondsByLeadId = isRecord(overridesRaw)
    ? Object.fromEntries(
        Object.entries(overridesRaw)
          .filter((entry): entry is [string, number] => {
            const [, value] = entry
            return typeof value === 'number' && Number.isFinite(value)
          })
          .map(([leadId, seconds]) => [leadId, Math.max(0, Math.floor(seconds))]),
      )
    : {}
  return {
    id: raw.id,
    label: raw.label,
    targetArrivalGapSeconds: Math.max(0, Math.floor(Number.isFinite(gap) ? gap : 0)),
    memberOrderIds,
    marchTimeOverrideSecondsByLeadId,
  }
}

function normalizeLead(raw: Record<string, unknown>): RallyLeadEntry | null {
  if (typeof raw.id !== 'string') return null
  const march =
    typeof raw.marchTimeSeconds === 'number'
      ? raw.marchTimeSeconds
      : typeof raw.arrivalSeconds === 'number'
        ? raw.arrivalSeconds
        : 0
  const travel =
    typeof raw.travelTimeSeconds === 'number' ? raw.travelTimeSeconds : 0
  const groupIds = Array.isArray(raw.groupIds)
    ? raw.groupIds.filter((id): id is string => typeof id === 'string')
    : raw.groupId === null
      ? []
      : typeof raw.groupId === 'string'
        ? [raw.groupId]
        : []
  const name = typeof raw.name === 'string' ? raw.name : ''
  return {
    id: raw.id,
    name,
    marchTimeSeconds: Math.max(0, Math.floor(Number.isFinite(march) ? march : 0)),
    travelTimeSeconds: Math.max(0, Math.floor(Number.isFinite(travel) ? travel : 0)),
    groupIds: [...new Set(groupIds)],
  }
}

function parsePayload(data: unknown): PersistedConfig | null {
  if (!isRecord(data) || data.version !== 1) return null
  if (!Array.isArray(data.groups) || !Array.isArray(data.leads)) return null
  if (typeof data.selectedGroupId !== 'string') return null

  const groups = data.groups
    .map((g) => (isRecord(g) ? normalizeGroup(g) : null))
    .filter((g): g is RallyGroup => g !== null)

  const leads = data.leads
    .map((r) => (isRecord(r) ? normalizeLead(r) : null))
    .filter((r): r is RallyLeadEntry => r !== null)

  const groupIds = new Set(groups.map((g) => g.id))
  const leadsSanitized = leads.map((r) => ({
    ...r,
    groupIds: r.groupIds.filter((id) => groupIds.has(id)),
  }))

  let selectedGroupId = data.selectedGroupId
  if (selectedGroupId && !groupIds.has(selectedGroupId)) selectedGroupId = ''

  return {
    version: 1,
    groups,
    leads: leadsSanitized,
    selectedGroupId,
  }
}

export function readPersistedConfig(): PersistedConfig | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parsePayload(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writePersistedConfig(config: PersistedConfig): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* quota or private mode */
  }
}

export function clearPersistedConfig(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

let bootstrap: PersistedConfig | undefined

/** First-call snapshot for React initial state (single localStorage read). */
export function loadBootstrapConfig(): PersistedConfig {
  if (bootstrap) return bootstrap
  const parsed = readPersistedConfig()
  bootstrap =
    parsed && parsed.groups.length > 0
      ? parsed
      : {
          version: 1,
          groups: [createGroup('Group 1')],
          leads: [],
          selectedGroupId: '',
        }
  return bootstrap
}
