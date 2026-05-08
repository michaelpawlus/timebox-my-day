import * as fs from 'fs'
import * as path from 'path'
import { parseICSFile } from '../../lib/ics-parse'
import { BusyEvent } from '../../lib/types'
import { getMondayOfWeek, getWeekDates } from '../../lib/week-utils'
import { addBusyEvents } from '../store'
import { addBusyEventToDay, getWeekSchedule } from '../week-store'

export async function importCalendar(filePath: string): Promise<{
  imported: number
  ignored: number
  ignored_reasons: string[]
}> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const result = parseICSFile(content, new Date())

  addBusyEvents(result.events)

  return {
    imported: result.events.length,
    ignored: result.ignoredCount,
    ignored_reasons: result.ignoredReasons,
  }
}

export function formatImportHuman(result: {
  imported: number
  ignored: number
  ignored_reasons: string[]
}): string {
  const lines = [`Imported ${result.imported} events`]
  if (result.ignored > 0) {
    lines.push(`Ignored ${result.ignored} events:`)
    for (const reason of result.ignored_reasons) {
      lines.push(`  - ${reason}`)
    }
  }
  return lines.join('\n')
}

const SUPPORTED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic'])

export interface PhotoExtractionEvent {
  title: string
  date: string       // YYYY-MM-DD
  start: string      // HH:MM (24-hour)
  end: string        // HH:MM (24-hour)
  location?: string
  notes?: string
}

export interface ImportPhotoBriefing {
  image_path: string
  week_of: string
  week_dates: string[]
  existing_events: BusyEvent[]
  schema: {
    description: string
    event_shape: Record<string, string>
    next_step: string
  }
}

export function importPhoto(imagePath: string, dateOpt?: string): ImportPhotoBriefing {
  const absPath = path.resolve(imagePath)
  if (!fs.existsSync(absPath)) {
    throw new Error(`Image not found: ${absPath}`)
  }
  const ext = path.extname(absPath).toLowerCase()
  if (!SUPPORTED_IMAGE_EXTS.has(ext)) {
    throw new Error(`Unsupported image type: ${ext} (expected jpg/jpeg/png/webp/heic)`)
  }

  const anchor = dateOpt ? dateOpt : new Date().toISOString().slice(0, 10)
  const weekOf = getMondayOfWeek(anchor)
  const weekDates = getWeekDates(weekOf)
  const schedule = getWeekSchedule(weekOf)

  const existing: BusyEvent[] = []
  for (const date of weekDates) {
    const day = schedule.days[date]
    if (day) existing.push(...day.busyEvents)
  }

  return {
    image_path: absPath,
    week_of: weekOf,
    week_dates: weekDates,
    existing_events: existing,
    schema: {
      description:
        'Read the image at image_path, extract calendar events, then call: timebox calendar add-events --events \'[...]\'',
      event_shape: {
        title: 'string — event title',
        date: 'string — YYYY-MM-DD (must fall within week_dates)',
        start: 'string — HH:MM 24-hour',
        end: 'string — HH:MM 24-hour',
        location: 'string (optional)',
        notes: 'string (optional)',
      },
      next_step:
        'After confirming events with the user, run: timebox calendar add-events --events \'<JSON-array>\'',
    },
  }
}

export function formatImportPhotoHuman(briefing: ImportPhotoBriefing): string {
  const lines: string[] = []
  lines.push(`Image: ${briefing.image_path}`)
  lines.push(`Target week: ${briefing.week_of} (${briefing.week_dates[0]} to ${briefing.week_dates[6]})`)
  lines.push(`Existing events in week: ${briefing.existing_events.length}`)
  lines.push('')
  lines.push('Next step (for the agent):')
  lines.push('  1. Read the image at the path above')
  lines.push('  2. Extract events as JSON array of { title, date, start, end, location?, notes? }')
  lines.push('  3. Confirm with user, then run:')
  lines.push("     timebox calendar add-events --events '<JSON-array>'")
  lines.push('  Use --json on this command to get the full briefing as JSON.')
  return lines.join('\n')
}

function hashId(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(36)
}

function isoForDateTime(date: string, time: string): string {
  return `${date}T${time}:00`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function validateEvent(e: PhotoExtractionEvent, idx: number): void {
  if (!e || typeof e !== 'object') {
    throw new Error(`Event ${idx}: not an object`)
  }
  if (!e.title || typeof e.title !== 'string') {
    throw new Error(`Event ${idx}: missing or invalid title`)
  }
  if (!DATE_RE.test(e.date)) {
    throw new Error(`Event ${idx} (${e.title}): invalid date "${e.date}" — expected YYYY-MM-DD`)
  }
  if (!TIME_RE.test(e.start)) {
    throw new Error(`Event ${idx} (${e.title}): invalid start "${e.start}" — expected HH:MM`)
  }
  if (!TIME_RE.test(e.end)) {
    throw new Error(`Event ${idx} (${e.title}): invalid end "${e.end}" — expected HH:MM`)
  }
}

export interface AddEventsResult {
  added: number
  skipped: number
  skipped_reasons: string[]
  weeks_touched: string[]
  events: BusyEvent[]
}

export function addEventsFromPhoto(
  events: PhotoExtractionEvent[],
  dateOpt?: string,
): AddEventsResult {
  if (!Array.isArray(events)) {
    throw new Error('--events must be a JSON array of events')
  }
  events.forEach(validateEvent)

  const constrainedWeek = dateOpt ? getMondayOfWeek(dateOpt) : undefined
  const constrainedDates = constrainedWeek ? new Set(getWeekDates(constrainedWeek)) : undefined

  const weeksTouched = new Set<string>()
  const writtenEvents: BusyEvent[] = []
  const skippedReasons: string[] = []
  let skipped = 0

  for (const e of events) {
    if (constrainedDates && !constrainedDates.has(e.date)) {
      skipped++
      skippedReasons.push(
        `${e.title} on ${e.date}: outside target week ${constrainedWeek}`,
      )
      continue
    }
    const startIso = isoForDateTime(e.date, e.start)
    const endIso = isoForDateTime(e.date, e.end)
    const id = `photo-${hashId(`${startIso}-${endIso}-${e.title}`)}`
    const busy: BusyEvent = {
      id,
      title: e.title,
      start: startIso,
      end: endIso,
      location: e.location,
      source: 'photo',
    }
    const monday = getMondayOfWeek(e.date)
    const before = getWeekSchedule(monday).days[e.date]?.busyEvents.length ?? 0
    addBusyEventToDay(monday, e.date, busy)
    const after = getWeekSchedule(monday).days[e.date]?.busyEvents.length ?? 0
    if (after > before) {
      writtenEvents.push(busy)
      weeksTouched.add(monday)
    } else {
      skipped++
      skippedReasons.push(`${e.title} on ${e.date} ${e.start}-${e.end}: duplicate of existing event`)
    }
  }

  return {
    added: writtenEvents.length,
    skipped,
    skipped_reasons: skippedReasons,
    weeks_touched: Array.from(weeksTouched),
    events: writtenEvents,
  }
}

export function formatAddEventsHuman(result: AddEventsResult): string {
  const lines: string[] = []
  lines.push(`Added ${result.added} event${result.added === 1 ? '' : 's'}`)
  if (result.weeks_touched.length > 0) {
    lines.push(`Weeks touched: ${result.weeks_touched.join(', ')}`)
  }
  if (result.skipped > 0) {
    lines.push(`Skipped ${result.skipped}:`)
    for (const reason of result.skipped_reasons) {
      lines.push(`  - ${reason}`)
    }
  }
  return lines.join('\n')
}
