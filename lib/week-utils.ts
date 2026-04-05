import { startOfWeek, addDays, format, parseISO } from 'date-fns'
import { BusyEvent, PlanBlock, Gap } from './types'

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(m: number): string {
  const hours = Math.floor(m / 60)
  const mins = m % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export function isoToTime(iso: string): string {
  const d = parseISO(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/**
 * Get the Monday of the week containing the given date.
 */
export function getMondayOfWeek(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  const monday = startOfWeek(d, { weekStartsOn: 1 })
  return format(monday, 'yyyy-MM-dd')
}

/**
 * Get all 7 date strings (YYYY-MM-DD) for the week starting on the given Monday.
 */
export function getWeekDates(mondayStr: string): string[] {
  const monday = parseISO(mondayStr)
  return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'))
}

/**
 * Compute gaps (free time) for a single day given busy events and plan blocks.
 */
export function computeDayGaps(
  busyEvents: BusyEvent[],
  planBlocks: PlanBlock[],
  dayStart: string = '07:00',
  dayEnd: string = '21:00',
): Gap[] {
  const intervals: [number, number][] = []

  for (const event of busyEvents) {
    if (event.allDay) continue
    intervals.push([timeToMinutes(isoToTime(event.start)), timeToMinutes(isoToTime(event.end))])
  }

  for (const block of planBlocks) {
    intervals.push([timeToMinutes(isoToTime(block.start)), timeToMinutes(isoToTime(block.end))])
  }

  intervals.sort((a, b) => a[0] - b[0])

  // Merge overlapping intervals
  const merged: [number, number][] = []
  for (const [s, e] of intervals) {
    if (merged.length > 0 && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e)
    } else {
      merged.push([s, e])
    }
  }

  // Find gaps within the day window
  const gaps: Gap[] = []
  const dayStartMin = timeToMinutes(dayStart)
  const dayEndMin = timeToMinutes(dayEnd)
  let cursor = dayStartMin

  for (const [s, e] of merged) {
    const blockStart = Math.max(s, dayStartMin)
    const blockEnd = Math.min(e, dayEndMin)

    if (cursor < blockStart) {
      const gapDuration = blockStart - cursor
      if (gapDuration > 0) {
        gaps.push({
          start: minutesToTime(cursor),
          end: minutesToTime(blockStart),
          duration_minutes: gapDuration,
        })
      }
    }
    cursor = Math.max(cursor, blockEnd)
  }

  // Final gap to end of day
  if (cursor < dayEndMin) {
    gaps.push({
      start: minutesToTime(cursor),
      end: minutesToTime(dayEndMin),
      duration_minutes: dayEndMin - cursor,
    })
  }

  return gaps
}

/**
 * Format a date string for display: "MONDAY April 6"
 */
export function formatDayHeader(dateStr: string): string {
  const d = parseISO(dateStr)
  const dayName = format(d, 'EEEE').toUpperCase()
  const monthDay = format(d, 'MMMM d')
  return `${dayName} ${monthDay}`
}
