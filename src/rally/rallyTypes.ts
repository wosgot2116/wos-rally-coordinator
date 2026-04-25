export type RallyGroup = {
  id: string
  label: string
  /**
   * Seconds between consecutive members’ target fort arrivals in list order.
   * With march durations Dᵢ, member index i aims for arrival at T₀ + i×gap
   * (T₀ chosen so rally departures are non‑negative). 0 = same target instant for all.
   */
  targetArrivalGapSeconds: number
  /**
   * Lead ids in departure / script order for this group only.
   * Roster order is the `leads` array; this list does not reorder the roster.
   */
  memberOrderIds: string[]
  /**
   * Optional march-time overrides (seconds) for members in this specific group.
   * Missing key means "use roster march time".
   */
  marchTimeOverrideSecondsByLeadId: Record<string, number>
}

export type RallyLeadEntry = {
  id: string
  name: string
  /** Seconds from rally go to fort arrival (roster “March time”, mm:ss). */
  marchTimeSeconds: number
  /** Optional extra march seconds; added to {@link marchTimeSeconds} for scheduling. */
  travelTimeSeconds: number
  /** Group ids this lead is assigned to. Empty means unassigned. */
  groupIds: string[]
}

export function createEmptyLead(): RallyLeadEntry {
  return {
    id: crypto.randomUUID(),
    name: '',
    marchTimeSeconds: 0,
    travelTimeSeconds: 0,
    groupIds: [],
  }
}

export function createGroup(label: string): RallyGroup {
  return {
    id: crypto.randomUUID(),
    label,
    targetArrivalGapSeconds: 0,
    memberOrderIds: [],
    marchTimeOverrideSecondsByLeadId: {},
  }
}
