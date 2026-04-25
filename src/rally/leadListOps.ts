export function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list
  }
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Reorder items matching `isInSubset` using indices in the filtered view. */
export function moveWithinSubset<T>(
  list: T[],
  isInSubset: (item: T) => boolean,
  fromSubsetIndex: number,
  toSubsetIndex: number,
): T[] {
  const indices: number[] = []
  list.forEach((item, i) => {
    if (isInSubset(item)) indices.push(i)
  })
  const fromAll = indices[fromSubsetIndex]
  const toAll = indices[toSubsetIndex]
  if (fromAll === undefined || toAll === undefined) return list
  return moveIndex(list, fromAll, toAll)
}

/** Group panel / script order: `memberOrderIds` first, then roster order for any missing ids. */
export function orderLeadsForGroup<T extends { id: string; groupIds: string[] }>(
  leads: T[],
  groupId: string,
  memberOrderIds: string[],
): T[] {
  const inGroup = leads.filter((l) => l.groupIds.includes(groupId))
  if (inGroup.length === 0) return []
  const rosterIndex = new Map<string, number>()
  leads.forEach((l, i) => rosterIndex.set(l.id, i))
  const orderPos = new Map<string, number>()
  memberOrderIds.forEach((id, i) => orderPos.set(id, i))
  return [...inGroup].sort((a, b) => {
    const pa = orderPos.has(a.id) ? orderPos.get(a.id)! : Number.MAX_SAFE_INTEGER
    const pb = orderPos.has(b.id) ? orderPos.get(b.id)! : Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return (rosterIndex.get(a.id) ?? 0) - (rosterIndex.get(b.id) ?? 0)
  })
}
