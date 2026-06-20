import { NextResponse } from 'next/server'
import { format, parseISO, isToday as isTodayFn } from 'date-fns'
import { synthesizeDay } from '@/lib/synthesizer'
import { getMondayOfWeek } from '@/lib/week-utils'
import { BusyEvent, PlanBlock } from '@/lib/types'
import { readInbox, InboxItem } from '@/cli/inbox-store'
import { readCatalog } from '@/cli/catalog-store'
import { fetchWeather } from '@/cli/commands/weather'
import { fetchWorkout } from '@/cli/commands/workout'
import { WeatherData, WorkoutData } from '@/cli/types'

// The synthesizer reads the Obsidian inbox + code catalog from the filesystem and
// shells out for weather/workout, so this route must run on the Node.js runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PlanDayRequest {
  date?: string                       // YYYY-MM-DD; defaults to today
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

  // Weather: only meaningful for today/future (Open-Meteo forecast starts today).
  let weather: WeatherData | null = null
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  if (target >= todayStr) {
    try {
      weather = await fetchWeather()
    } catch {
      weather = null
    }
  }

  // Workout: only for today (workout-app CLI returns today's workout).
  let workout: WorkoutData | null = null
  if (isTodayFn(parseISO(target))) {
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
