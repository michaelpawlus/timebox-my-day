import * as fs from 'fs'
import * as path from 'path'
import { format } from 'date-fns'
import { BusyEvent, PlanBlock, UnscheduledBlock } from '../lib/types'
import { DaySchedule } from './types'

const STORE_DIR = path.join(process.env.HOME || '~', '.timebox')
const STORE_FILE = path.join(STORE_DIR, 'schedule.json')

function ensureDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true })
  }
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function readStore(): DaySchedule {
  ensureDir()
  const today = todayStr()

  if (!fs.existsSync(STORE_FILE)) {
    return emptySchedule(today)
  }

  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8')
    const data: DaySchedule = JSON.parse(raw)

    // Auto-reset when date changes
    if (data.date !== today) {
      const fresh = emptySchedule(today)
      writeStore(fresh)
      return fresh
    }

    return data
  } catch {
    return emptySchedule(today)
  }
}

function writeStore(schedule: DaySchedule): void {
  ensureDir()
  fs.writeFileSync(STORE_FILE, JSON.stringify(schedule, null, 2), 'utf-8')
}

function emptySchedule(date: string): DaySchedule {
  return {
    date,
    busy_events: [],
    plan_blocks: [],
    unscheduled_blocks: [],
  }
}

export function getSchedule(): DaySchedule {
  return readStore()
}

export function addBusyEvent(event: BusyEvent): DaySchedule {
  const schedule = readStore()
  // Deduplicate by id
  if (!schedule.busy_events.find(e => e.id === event.id)) {
    schedule.busy_events.push(event)
  }
  writeStore(schedule)
  return schedule
}

export function addBusyEvents(events: BusyEvent[]): DaySchedule {
  const schedule = readStore()
  for (const event of events) {
    if (!schedule.busy_events.find(e => e.id === event.id)) {
      schedule.busy_events.push(event)
    }
  }
  writeStore(schedule)
  return schedule
}

export function addPlanBlock(block: PlanBlock): DaySchedule {
  const schedule = readStore()
  schedule.plan_blocks.push(block)
  writeStore(schedule)
  return schedule
}

export function addUnscheduledBlock(block: UnscheduledBlock): DaySchedule {
  const schedule = readStore()
  schedule.unscheduled_blocks.push(block)
  writeStore(schedule)
  return schedule
}

export function removeBlock(id: string): { schedule: DaySchedule; found: boolean } {
  const schedule = readStore()
  const planIdx = schedule.plan_blocks.findIndex(b => b.id === id)
  if (planIdx >= 0) {
    schedule.plan_blocks.splice(planIdx, 1)
    writeStore(schedule)
    return { schedule, found: true }
  }
  const unschedIdx = schedule.unscheduled_blocks.findIndex(b => b.id === id)
  if (unschedIdx >= 0) {
    schedule.unscheduled_blocks.splice(unschedIdx, 1)
    writeStore(schedule)
    return { schedule, found: true }
  }
  const busyIdx = schedule.busy_events.findIndex(b => b.id === id)
  if (busyIdx >= 0) {
    schedule.busy_events.splice(busyIdx, 1)
    writeStore(schedule)
    return { schedule, found: true }
  }
  return { schedule, found: false }
}

export function clearPlanBlocks(): DaySchedule {
  const schedule = readStore()
  schedule.plan_blocks = []
  schedule.unscheduled_blocks = []
  writeStore(schedule)
  return schedule
}
