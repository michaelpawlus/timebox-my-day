import { ParsedBlockInput } from './types'
import { getColorForTitle } from './categories'

export function parseTimeString(str: string): number | null {
  const trimmed = str.trim().toLowerCase()

  // Match "2pm", "2:30pm", "14:00", "2:30 pm", "2 pm"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (match12) {
    let hours = parseInt(match12[1], 10)
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0
    const period = match12[3]
    if (period === 'pm' && hours !== 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0
    return hours * 60 + minutes
  }

  // Match 24-hour "14:00", "8:30"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const hours = parseInt(match24[1], 10)
    const minutes = parseInt(match24[2], 10)
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return hours * 60 + minutes
    }
  }

  return null
}

export function parseDuration(str: string): number | null {
  const trimmed = str.trim().toLowerCase()

  // Match "2 hours", "1.5 hours", "2h", "1.5h", "2 hr", "2 hrs"
  const hourMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)$/)
  if (hourMatch) {
    return Math.round(parseFloat(hourMatch[1]) * 60)
  }

  // Match "30 min", "30 minutes", "30m", "45 mins"
  const minMatch = trimmed.match(/^(\d+)\s*(?:minutes?|mins?|m)$/)
  if (minMatch) {
    return parseInt(minMatch[1], 10)
  }

  return null
}

export function parseTextInput(input: string): ParsedBlockInput[] {
  // Split on semicolons or newlines
  const segments = input.split(/[;\n]/).map(s => s.trim()).filter(Boolean)
  const results: ParsedBlockInput[] = []

  for (const segment of segments) {
    // Split on " - " (space-hyphen-space)
    const parts = segment.split(/\s+-\s+/)

    if (parts.length >= 3) {
      // Could be "Title - 2pm - 4pm" (scheduled) or "Title - Sub - 2 hours" (unscheduled with compound title)
      const lastPart = parts[parts.length - 1]
      const secondLastPart = parts[parts.length - 2]

      const endTime = parseTimeString(lastPart)
      const startTime = parseTimeString(secondLastPart)

      if (startTime !== null && endTime !== null) {
        // Scheduled block: "Meeting - 2pm - 4pm"
        const title = parts.slice(0, -2).join(' - ')
        const duration = endTime > startTime ? endTime - startTime : (endTime + 24 * 60) - startTime
        const { color, category } = getColorForTitle(title)
        results.push({
          title,
          durationMinutes: duration,
          startMinutes: startTime,
          endMinutes: endTime > startTime ? endTime : endTime + 24 * 60,
          color,
          category,
        })
        continue
      }

      // Check if last part is a duration
      const duration = parseDuration(lastPart)
      if (duration !== null) {
        const title = parts.slice(0, -1).join(' - ')
        const { color, category } = getColorForTitle(title)
        results.push({ title, durationMinutes: duration, color, category })
        continue
      }

      // Fallback: treat entire segment as title with 60min default
      const { color, category } = getColorForTitle(segment)
      results.push({ title: segment, durationMinutes: 60, color, category })
    } else if (parts.length === 2) {
      // Could be "Title - 2 hours" (duration) or "Title - 2pm" (just a time, treat as duration)
      const duration = parseDuration(parts[1])
      if (duration !== null) {
        const title = parts[0]
        const { color, category } = getColorForTitle(title)
        results.push({ title, durationMinutes: duration, color, category })
        continue
      }

      // Fallback: treat whole thing as title
      const { color, category } = getColorForTitle(segment)
      results.push({ title: segment, durationMinutes: 60, color, category })
    } else {
      // Single part — no delimiter found, 60-min unscheduled block
      const { color, category } = getColorForTitle(segment)
      results.push({ title: segment, durationMinutes: 60, color, category })
    }
  }

  return results
}
