import * as fs from 'fs'
import * as path from 'path'
import { format } from 'date-fns'
import { PlanBlock, UnscheduledBlock } from '../../lib/types'
import { getColorForTitle } from '../../lib/categories'
import { generateICS } from '../../lib/ics-generate'
import { computeDayGaps, isoToTime, timeToMinutes } from '../../lib/week-utils'
import { getSchedule, addPlanBlock, addUnscheduledBlock, removeBlock, clearPlanBlocks } from '../store'
import { ScheduleView } from '../types'

const DAY_START = '07:00'
const DAY_END = '21:00'

export function showSchedule(): ScheduleView {
  const schedule = getSchedule()
  const gaps = computeDayGaps(schedule.busy_events, schedule.plan_blocks, DAY_START, DAY_END)

  const totalScheduledMinutes = schedule.busy_events
    .filter(e => !e.allDay)
    .reduce((sum, e) => {
      const s = timeToMinutes(isoToTime(e.start))
      const end = timeToMinutes(isoToTime(e.end))
      return sum + (end - s)
    }, 0)
    + schedule.plan_blocks.reduce((sum, b) => {
      const s = timeToMinutes(isoToTime(b.start))
      const end = timeToMinutes(isoToTime(b.end))
      return sum + (end - s)
    }, 0)

  const dayTotalMinutes = timeToMinutes(DAY_END) - timeToMinutes(DAY_START)
  const totalFreeMinutes = gaps.reduce((sum, g) => sum + g.duration_minutes, 0)

  return {
    date: schedule.date,
    day_start: DAY_START,
    day_end: DAY_END,
    busy_events: schedule.busy_events,
    plan_blocks: schedule.plan_blocks,
    unscheduled_blocks: schedule.unscheduled_blocks,
    gaps,
    total_scheduled_minutes: totalScheduledMinutes,
    total_free_minutes: totalFreeMinutes,
  }
}

export function addScheduleBlock(opts: {
  title: string
  start?: string
  end?: string
  duration?: number
  notes?: string
}): { block: PlanBlock | UnscheduledBlock; type: 'scheduled' | 'unscheduled' } {
  const { color, category } = getColorForTitle(opts.title)
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

  if (opts.start && opts.end) {
    // Scheduled block
    const today = format(new Date(), 'yyyy-MM-dd')
    const block: PlanBlock = {
      id,
      title: opts.title,
      start: `${today}T${opts.start}:00`,
      end: `${today}T${opts.end}:00`,
      color,
      category,
      notes: opts.notes,
    }
    addPlanBlock(block)
    return { block, type: 'scheduled' }
  } else if (opts.duration) {
    // Unscheduled block (holding area)
    const block: UnscheduledBlock = {
      id,
      title: opts.title,
      durationMinutes: opts.duration,
      color,
      category,
    }
    addUnscheduledBlock(block)
    return { block, type: 'unscheduled' }
  } else {
    throw new Error('Either --start and --end, or --duration must be provided')
  }
}

export function removeScheduleBlock(id: string): { found: boolean } {
  const { found } = removeBlock(id)
  return { found }
}

export function clearSchedule(): { cleared: number } {
  const schedule = getSchedule()
  const count = schedule.plan_blocks.length + schedule.unscheduled_blocks.length
  clearPlanBlocks()
  return { cleared: count }
}

export function exportSchedule(fmt: 'ics' | 'markdown'): { path: string; content: string } {
  const view = showSchedule()

  if (fmt === 'ics') {
    const icsContent = generateICS(view.plan_blocks)
    const fileName = `timebox-plan-${view.date}.ics`
    const outPath = path.join(process.cwd(), fileName)
    fs.writeFileSync(outPath, icsContent, 'utf-8')
    return { path: outPath, content: icsContent }
  }

  // Markdown export to Obsidian
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH
  if (!vaultPath) {
    throw new Error('OBSIDIAN_VAULT_PATH environment variable is required for markdown export')
  }

  const outDir = path.join(vaultPath, 'timebox')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  const outPath = path.join(outDir, `${view.date}.md`)

  const lines: string[] = [
    `# Day Plan: ${view.date}`,
    '',
    `**Window:** ${view.day_start} - ${view.day_end} | **Scheduled:** ${view.total_scheduled_minutes} min | **Free:** ${view.total_free_minutes} min`,
    '',
    '## Timeline',
    '',
    '| Time | Block | Type |',
    '|------|-------|------|',
  ]

  // Merge all blocks and sort by time
  type TimeEntry = { start: string; end: string; title: string; type: string }
  const entries: TimeEntry[] = []

  for (const e of view.busy_events) {
    if (!e.allDay) {
      entries.push({ start: isoToTime(e.start), end: isoToTime(e.end), title: e.title, type: 'busy' })
    }
  }
  for (const b of view.plan_blocks) {
    entries.push({ start: isoToTime(b.start), end: isoToTime(b.end), title: b.title, type: b.category || 'plan' })
  }

  entries.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))

  for (const entry of entries) {
    lines.push(`| ${entry.start} - ${entry.end} | ${entry.title} | ${entry.type} |`)
  }

  if (view.unscheduled_blocks.length > 0) {
    lines.push('', '## Unscheduled', '')
    for (const b of view.unscheduled_blocks) {
      lines.push(`- [ ] ${b.title} (~${b.durationMinutes} min)`)
    }
  }

  if (view.gaps.length > 0) {
    lines.push('', '## Available Gaps', '')
    for (const g of view.gaps) {
      lines.push(`- ${g.start} - ${g.end} (${g.duration_minutes} min)`)
    }
  }

  lines.push('')
  const content = lines.join('\n')
  fs.writeFileSync(outPath, content, 'utf-8')
  return { path: outPath, content }
}

export function formatScheduleHuman(view: ScheduleView): string {
  const lines: string[] = [
    `Schedule for ${view.date} (${view.day_start} - ${view.day_end})`,
    `Scheduled: ${view.total_scheduled_minutes} min | Free: ${view.total_free_minutes} min`,
    '',
  ]

  if (view.busy_events.length > 0) {
    lines.push('Busy events:')
    for (const e of view.busy_events) {
      if (e.allDay) {
        lines.push(`  [all day] ${e.title}`)
      } else {
        lines.push(`  ${isoToTime(e.start)}-${isoToTime(e.end)} ${e.title}`)
      }
    }
    lines.push('')
  }

  if (view.plan_blocks.length > 0) {
    lines.push('Plan blocks:')
    for (const b of view.plan_blocks) {
      lines.push(`  ${isoToTime(b.start)}-${isoToTime(b.end)} ${b.title} [${b.id}]`)
    }
    lines.push('')
  }

  if (view.unscheduled_blocks.length > 0) {
    lines.push('Unscheduled:')
    for (const b of view.unscheduled_blocks) {
      lines.push(`  ${b.title} (~${b.durationMinutes} min) [${b.id}]`)
    }
    lines.push('')
  }

  if (view.gaps.length > 0) {
    lines.push('Gaps:')
    for (const g of view.gaps) {
      lines.push(`  ${g.start}-${g.end} (${g.duration_minutes} min)`)
    }
  }

  return lines.join('\n')
}
