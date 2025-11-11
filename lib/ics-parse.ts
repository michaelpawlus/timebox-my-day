import ICAL from 'ical.js'
import { BusyEvent } from './types'
import { isWithinDay } from './time'

function createHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export interface ParseResult {
  events: BusyEvent[]
  totalEvents: number
  ignoredCount: number
  ignoredReasons: string[]
}

export function parseICSFile(fileContent: string, targetDate: Date): ParseResult {
  const events: BusyEvent[] = []
  const ignoredReasons: string[] = []
  let totalEvents = 0

  try {
    const jcalData = ICAL.parse(fileContent)
    const comp = new ICAL.Component(jcalData)
    const vevents = comp.getAllSubcomponents('vevent')

    totalEvents = vevents.length

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent)
        
        // Skip recurring events in v0
        if (event.isRecurring()) {
          ignoredReasons.push(`Recurring event: ${event.summary}`)
          continue
        }

        const startDate = event.startDate.toJSDate()
        const endDate = event.endDate.toJSDate()

        // Skip all-day events that are outside the working window
        if (event.startDate.isDate) {
          ignoredReasons.push(`All-day event: ${event.summary}`)
          continue
        }

        // Filter events for the target date
        if (!isWithinDay(startDate.toISOString(), targetDate)) {
          continue
        }

        const busyEvent: BusyEvent = {
          id: createHash(`${startDate.toISOString()}-${endDate.toISOString()}-${event.summary}`),
          title: event.summary || 'Untitled Event',
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          location: event.location || undefined,
          source: 'ics',
          allDay: event.startDate.isDate,
        }

        events.push(busyEvent)
      } catch (err) {
        console.error('Error parsing individual event:', err)
        ignoredReasons.push(`Parse error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
  } catch (err) {
    throw new Error(`Failed to parse ICS file: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  return {
    events,
    totalEvents,
    ignoredCount: totalEvents - events.length,
    ignoredReasons,
  }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result
      if (typeof content === 'string') {
        resolve(content)
      } else {
        reject(new Error('Failed to read file as text'))
      }
    }
    reader.onerror = () => reject(new Error('File reading error'))
    reader.readAsText(file)
  })
}

