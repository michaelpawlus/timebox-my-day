import * as fs from 'fs'
import * as path from 'path'
import { format, parseISO, addDays } from 'date-fns'
import { PlanBlock } from '../../lib/types'
import { getColorForTitle } from '../../lib/categories'
import { generateBlockId } from '../../lib/id'
import {
  getMondayOfWeek,
  getWeekDates,
  computeDayGaps,
  formatDayHeader,
  isoToTime,
  timeToMinutes,
} from '../../lib/week-utils'
import {
  getWeekSchedule,
  addPlanBlockToDay,
  removePlanBlockFromDay,
  clearDay as storeClearDay,
  clearWeek as storeClearWeek,
} from '../week-store'
import { WeekSchedule, DayGaps } from '../types'

const DAY_START = '07:00'
const DAY_END = '21:00'

function computeWeekGaps(schedule: WeekSchedule): DayGaps[] {
  const dates = getWeekDates(schedule.weekOf)
  return dates.map(date => {
    const day = schedule.days[date]
    if (!day) {
      return { date, gaps: [], total_free_minutes: 0, total_scheduled_minutes: 0 }
    }
    const gaps = computeDayGaps(day.busyEvents, day.planBlocks, DAY_START, DAY_END)
    const totalFree = gaps.reduce((sum, g) => sum + g.duration_minutes, 0)
    const dayTotal = timeToMinutes(DAY_END) - timeToMinutes(DAY_START)
    return {
      date,
      gaps,
      total_free_minutes: totalFree,
      total_scheduled_minutes: dayTotal - totalFree,
    }
  })
}

export function showWeek(date?: string): WeekSchedule & { dailyGaps: DayGaps[] } {
  const target = date || format(new Date(), 'yyyy-MM-dd')
  const mondayStr = getMondayOfWeek(target)
  const schedule = getWeekSchedule(mondayStr)
  const dailyGaps = computeWeekGaps(schedule)
  return { ...schedule, dailyGaps }
}

export function addWeekBlock(opts: {
  date: string
  title: string
  start: string
  end: string
  category?: string
  notes?: string
}): { block: PlanBlock; weekOf: string } {
  const mondayStr = getMondayOfWeek(opts.date)
  const { color, category } = getColorForTitle(opts.title)

  const block: PlanBlock = {
    id: generateBlockId(),
    title: opts.title,
    start: `${opts.date}T${opts.start}:00`,
    end: `${opts.date}T${opts.end}:00`,
    color,
    category: (opts.category as PlanBlock['category']) || category,
    notes: opts.notes,
  }

  addPlanBlockToDay(mondayStr, opts.date, block)
  return { block, weekOf: mondayStr }
}

export function removeWeekBlock(date: string, id: string): { found: boolean } {
  const mondayStr = getMondayOfWeek(date)
  const { found } = removePlanBlockFromDay(mondayStr, date, id)
  return { found }
}

export function clearWeekDay(date?: string): { cleared: number; weekOf: string } {
  if (date) {
    const mondayStr = getMondayOfWeek(date)
    const schedule = getWeekSchedule(mondayStr)
    const day = schedule.days[date]
    const count = day ? day.planBlocks.length : 0
    storeClearDay(mondayStr, date)
    return { cleared: count, weekOf: mondayStr }
  }
  // Clear entire current week
  const mondayStr = getMondayOfWeek(new Date())
  const schedule = getWeekSchedule(mondayStr)
  let count = 0
  for (const day of Object.values(schedule.days)) {
    count += day.planBlocks.length
  }
  storeClearWeek(mondayStr)
  return { cleared: count, weekOf: mondayStr }
}

export function exportWeek(fmt: 'markdown', date?: string): { content: string; path?: string } {
  const target = date || format(new Date(), 'yyyy-MM-dd')
  const mondayStr = getMondayOfWeek(target)
  const schedule = getWeekSchedule(mondayStr)
  const dates = getWeekDates(mondayStr)

  const sundayStr = dates[dates.length - 1]
  const mondayDate = parseISO(mondayStr)
  const sundayDate = parseISO(sundayStr)
  const headerStart = format(mondayDate, 'MMMM d').toUpperCase()
  const headerEnd = format(sundayDate, 'd, yyyy').toUpperCase()

  const lines: string[] = [`WEEK OF ${headerStart}-${headerEnd}`, '']

  for (const dateStr of dates) {
    const day = schedule.days[dateStr]
    lines.push(formatDayHeader(dateStr))

    if (!day || (day.busyEvents.length === 0 && day.planBlocks.length === 0)) {
      lines.push('  (no blocks scheduled)')
      lines.push('')
      continue
    }

    // Merge busy events and plan blocks, sort by start time
    type Entry = { start: string; end: string; title: string }
    const entries: Entry[] = []

    for (const e of day.busyEvents) {
      if (!e.allDay) {
        entries.push({ start: isoToTime(e.start), end: isoToTime(e.end), title: e.title })
      }
    }
    for (const b of day.planBlocks) {
      entries.push({ start: isoToTime(b.start), end: isoToTime(b.end), title: b.title })
    }

    entries.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))

    for (const entry of entries) {
      lines.push(`  ${entry.start}-${entry.end}  ${entry.title}`)
    }
    lines.push('')
  }

  const content = lines.join('\n')

  // Write to Obsidian vault if available
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH
  if (vaultPath) {
    const outDir = path.join(vaultPath, 'timebox')
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }
    const outPath = path.join(outDir, `week-${mondayStr}.md`)
    fs.writeFileSync(outPath, content, 'utf-8')
    return { content, path: outPath }
  }

  return { content }
}

export function formatWeekHuman(schedule: WeekSchedule, dailyGaps: DayGaps[]): string {
  const dates = getWeekDates(schedule.weekOf)
  const lines: string[] = [`Week of ${schedule.weekOf}`, '']

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i]
    const day = schedule.days[dateStr]
    const gaps = dailyGaps[i]

    lines.push(formatDayHeader(dateStr))

    if (!day || (day.busyEvents.length === 0 && day.planBlocks.length === 0)) {
      lines.push(`  (empty) — ${gaps?.total_free_minutes || 0} min free`)
      lines.push('')
      continue
    }

    // Merge and sort
    type Entry = { start: string; end: string; title: string; id?: string }
    const entries: Entry[] = []

    for (const e of day.busyEvents) {
      if (!e.allDay) {
        entries.push({ start: isoToTime(e.start), end: isoToTime(e.end), title: `[busy] ${e.title}` })
      }
    }
    for (const b of day.planBlocks) {
      entries.push({ start: isoToTime(b.start), end: isoToTime(b.end), title: b.title, id: b.id })
    }

    entries.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))

    for (const entry of entries) {
      const idStr = entry.id ? ` [${entry.id.substring(0, 8)}]` : ''
      lines.push(`  ${entry.start}-${entry.end}  ${entry.title}${idStr}`)
    }

    if (gaps) {
      lines.push(`  — ${gaps.total_free_minutes} min free, ${gaps.total_scheduled_minutes} min scheduled`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
