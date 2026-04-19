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
