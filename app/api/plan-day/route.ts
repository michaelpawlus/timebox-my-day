import { NextResponse } from 'next/server'
import { format, parseISO, isToday as isTodayFn } from 'date-fns'
import { synthesizeDay } from '@/lib/synthesizer'
import { getMondayOfWeek } from '@/lib/week-utils'
import { BusyEvent, PlanBlock } from '@/lib/types'
import { readInbox, InboxItem } from '@/cli/inbox-store'
import { readCatalog } from '@/cli/catalog-store'
import { fetchWeatherForDate } from '@/cli/commands/weather'
import { fetchWorkout } from '@/cli/commands/workout'
import { WeatherData, WorkoutData } from '@/cli/types'

// The synthesizer reads the Obsidian inbox + code catalog from the filesystem and
// shells out for weather/workout, so this route must run on the Node.js runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PlanDayRequest {
  date?: string                       // YYYY-MM-DD; defaults to today
  today?: string                      // browser-local today (YYYY-MM-DD), for tz-correct "is today" checks
  busyEvents?: BusyEvent[]            // current canvas busy events
  existingPlanBlocks?: PlanBlock[]    // current canvas plan blocks
}

export async function POST(request: Request) {
  let body: PlanDayRequest
  try {
    body = (await request.json()) as PlanDayRequest
  } catch {
    body = {}
  }

  const target = body.date || format(new Date(), 'yyyy-MM-dd')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    return NextResponse.json({ error: `Invalid date "${target}" — must be YYYY-MM-DD` }, { status: 400 })
  }

  const mondayStr = getMondayOfWeek(target)
  const busy = body.busyEvents || []
  const existingPlanBlocks = body.existingPlanBlocks || []

  // Weather for the requested date (null for past dates / beyond the forecast horizon).
  let weather: WeatherData | null = null
  try {
    weather = await fetchWeatherForDate(target)
  } catch {
    weather = null
  }

  // Workout: only for today (the workout-app CLI returns today's workout). Use the
  // client's local "today" when provided so a server in a different timezone doesn't
  // attach the workout to the wrong selected date; fall back to the server clock.
  const isTargetToday = body.today ? target === body.today : isTodayFn(parseISO(target))
  let workout: WorkoutData | null = null
  if (isTargetToday) {
    try {
      workout = await fetchWorkout()
    } catch {
      workout = null
    }
  }

  let inboxItems: InboxItem[]
  try {
    inboxItems = readInbox().items.filter(i => !i.done)
  } catch {
    inboxItems = []
  }

  const catalog = readCatalog()

  const result = synthesizeDay({
    date: target,
    weekOf: mondayStr,
    busy,
    existingPlanBlocks,
    weather,
    workout,
    inboxItems,
    catalogIssues: catalog?.issues || [],
  })

  return NextResponse.json(result)
}
