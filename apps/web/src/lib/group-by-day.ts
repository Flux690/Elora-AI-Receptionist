import type { Group } from '@/components/ui/data-list'
import { dayKey, relativeDay } from './formatters'

/**
 * Consecutive rows sharing a day, labelled in the agent's zone.
 *
 * The rows arrive sorted, so this only has to compare against the group it is
 * building. Calls and escalations each had their own copy of this, identical
 * but for the field the timestamp lives on.
 */
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
