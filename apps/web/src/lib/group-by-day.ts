import type { Group } from '@/components/ui/data-list'
import { dayKey, relativeDay } from './formatters'

/** Rows arrive sorted, so this only compares against the group it is building. */
export function groupByDay<T>(
  rows: T[],
  zone: string | undefined,
  at: (row: T) => string,
): Group<T>[] {
  const groups: Group<T>[] = []
  for (const row of rows) {
    const key = dayKey(at(row), zone)
    const last = groups.at(-1)
    if (last?.key === key) last.rows.push(row)
    else groups.push({ key, label: relativeDay(at(row), zone), rows: [row] })
  }
  return groups
}
