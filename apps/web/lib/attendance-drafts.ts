// Refresh saved records without discarding edits to other people in the roster.
export function mergeAttendanceDrafts<T>(
  current: Record<string, T>,
  incoming: Record<string, T>,
  dirtyIds: ReadonlySet<string>,
): Record<string, T> {
  return Object.fromEntries(Object.entries(incoming).map(([id, value]) => [
    id, dirtyIds.has(id) && id in current ? current[id] : value,
  ]));
}
