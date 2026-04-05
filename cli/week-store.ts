import * as fs from 'fs'
import * as path from 'path'
import { BusyEvent, PlanBlock } from '../lib/types'
import { getWeekDates } from '../lib/week-utils'
import { DayPlan, WeekSchedule } from './types'

const STORE_DIR = path.join(process.env.HOME || '~', '.timebox')
const WEEKS_DIR = path.join(STORE_DIR, 'weeks')

function ensureDir(): void {
  if (!fs.existsSync(WEEKS_DIR)) {
    fs.mkdirSync(WEEKS_DIR, { recursive: true })
  }
}

function weekFilePath(mondayStr: string): string {
  return path.join(WEEKS_DIR, `${mondayStr}.json`)
}

function emptyDayPlan(date: string): DayPlan {
  return { date, busyEvents: [], planBlocks: [] }
}

function emptyWeekSchedule(mondayStr: string): WeekSchedule {
  const dates = getWeekDates(mondayStr)
  const days: Record<string, DayPlan> = {}
  for (const date of dates) {
    days[date] = emptyDayPlan(date)
  }
  return { weekOf: mondayStr, days }
}

function readWeek(mondayStr: string): WeekSchedule {
  ensureDir()
  const filePath = weekFilePath(mondayStr)
  if (!fs.existsSync(filePath)) {
    return emptyWeekSchedule(mondayStr)
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return emptyWeekSchedule(mondayStr)
  }
}

function writeWeek(schedule: WeekSchedule): void {
  ensureDir()
  fs.writeFileSync(weekFilePath(schedule.weekOf), JSON.stringify(schedule, null, 2), 'utf-8')
}

export function getWeekSchedule(mondayStr: string): WeekSchedule {
  return readWeek(mondayStr)
}

export function addPlanBlockToDay(mondayStr: string, date: string, block: PlanBlock): WeekSchedule {
  const schedule = readWeek(mondayStr)
  if (!schedule.days[date]) {
    schedule.days[date] = emptyDayPlan(date)
  }
  schedule.days[date].planBlocks.push(block)
  writeWeek(schedule)
  return schedule
}

export function addBusyEventToDay(mondayStr: string, date: string, event: BusyEvent): WeekSchedule {
  const schedule = readWeek(mondayStr)
  if (!schedule.days[date]) {
    schedule.days[date] = emptyDayPlan(date)
  }
  // Deduplicate by id
  if (!schedule.days[date].busyEvents.find(e => e.id === event.id)) {
    schedule.days[date].busyEvents.push(event)
  }
  writeWeek(schedule)
  return schedule
}

export function removePlanBlockFromDay(
  mondayStr: string,
  date: string,
  blockId: string,
): { schedule: WeekSchedule; found: boolean } {
  const schedule = readWeek(mondayStr)
  const day = schedule.days[date]
  if (!day) {
    return { schedule, found: false }
  }
  const idx = day.planBlocks.findIndex(b => b.id === blockId)
  if (idx < 0) {
    return { schedule, found: false }
  }
  day.planBlocks.splice(idx, 1)
  writeWeek(schedule)
  return { schedule, found: true }
}

export function clearDay(mondayStr: string, date: string): WeekSchedule {
  const schedule = readWeek(mondayStr)
  if (schedule.days[date]) {
    schedule.days[date].planBlocks = []
  }
  writeWeek(schedule)
  return schedule
}

export function clearWeek(mondayStr: string): WeekSchedule {
  const schedule = readWeek(mondayStr)
  for (const date of Object.keys(schedule.days)) {
    schedule.days[date].planBlocks = []
  }
  writeWeek(schedule)
  return schedule
}
