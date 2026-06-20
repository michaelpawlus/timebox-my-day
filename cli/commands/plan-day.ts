import { format, parseISO, isToday as isTodayFn } from 'date-fns'
import { getMondayOfWeek, formatDayHeader } from '../../lib/week-utils'
import { generateBlockId } from '../../lib/id'
import { getColorForTitle } from '../../lib/categories'
import { PlanBlock } from '../../lib/types'
import {
  ArchetypeId,
  ArchetypePlan,
  PlanBlockDraft,
  PlanDayResult,
  synthesizeDay,
} from '../../lib/synthesizer'
import { readInbox, InboxItem } from '../inbox-store'
import { readCatalog } from '../catalog-store'
import { addPlanBlockToDay, getWeekSchedule } from '../week-store'
import { fetchWeather } from './weather'
import { fetchWorkout } from './workout'
import { WeatherData, WorkoutData } from '../types'

// Re-export synthesizer types for backward compatibility with existing importers.
export type { ArchetypeId, ArchetypePlan, PlanBlockDraft, PlanDayResult }

export interface PlanDayApplied extends PlanDayResult {
  applied?: {
    archetype: ArchetypeId
    blocksWritten: number
  }
}

function readInboxSafe(): InboxItem[] {
  try {
    return readInbox().items.filter(i => !i.done)
  } catch {
    return []
  }
}

// ---------- Top-level synthesizer (IO wrapper) ----------

export interface PlanDayOpts {
  date?: string
  apply?: number   // 1-indexed archetype to apply
}

export async function planDay(opts: PlanDayOpts = {}): Promise<PlanDayApplied> {
  const target = opts.date || format(new Date(), 'yyyy-MM-dd')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    throw new Error(`Invalid date "${target}" — must be YYYY-MM-DD`)
  }
  const mondayStr = getMondayOfWeek(target)
  const weekSchedule = getWeekSchedule(mondayStr)
  const day = weekSchedule.days[target] || { date: target, busyEvents: [], planBlocks: [] }

  // Weather: single-day, only meaningful for today/future. Open-Meteo returns
  // forecast_days starting from today, so we only attempt when date >= today.
  let weather: WeatherData | null = null
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  if (target >= todayStr) {
    try {
      weather = await fetchWeather()
    } catch (err) {
      process.stderr.write(`Warning: could not fetch weather: ${err instanceof Error ? err.message : String(err)}\n`)
    }
  }

  // Workout: only for today (workout-app CLI returns today's workout)
  let workout: WorkoutData | null = null
  if (isTodayFn(parseISO(target))) {
    try {
      workout = await fetchWorkout()
    } catch (err) {
      process.stderr.write(`Warning: could not fetch workout: ${err instanceof Error ? err.message : String(err)}\n`)
    }
  }

  const catalog = readCatalog()

  const result: PlanDayApplied = synthesizeDay({
    date: target,
    weekOf: mondayStr,
    busy: day.busyEvents,
    existingPlanBlocks: day.planBlocks,
    weather,
    workout,
    inboxItems: readInboxSafe(),
    catalogIssues: catalog?.issues || [],
  })

  if (opts.apply !== undefined) {
    const idx = opts.apply - 1
    if (idx < 0 || idx >= result.plans.length) {
      throw new Error(`--apply ${opts.apply} is out of range (1..${result.plans.length})`)
    }
    const chosen = result.plans[idx]
    let written = 0
    for (const block of chosen.newBlocks) {
      const planBlock: PlanBlock = makePlanBlockFromDraft(target, block)
      addPlanBlockToDay(mondayStr, target, planBlock)
      written++
    }
    result.applied = { archetype: chosen.id, blocksWritten: written }
  }

  return result
}

export function makePlanBlockFromDraft(date: string, draft: PlanBlockDraft): PlanBlock {
  const { color, category } = getColorForTitle(draft.title)
  return {
    id: generateBlockId(),
    title: draft.title,
    start: `${date}T${draft.start}:00`,
    end: `${date}T${draft.end}:00`,
    color,
    category: draft.category || category,
    notes: draft.notes,
  }
}

// ---------- Human output ----------

function formatPlanBlock(b: PlanBlockDraft): string {
  const tag =
    b.source === 'busy' ? '[busy]' :
    b.source === 'lunch' ? '[lunch]' :
    b.source === 'workout' ? '[workout]' :
    b.source === 'inbox' ? '[inbox]' :
    b.source === 'catalog' ? '[code]' :
    b.source === 'existing-plan' ? '[existing]' : ''
  return `    ${b.start}-${b.end}  ${tag.padEnd(10)} ${b.title}`
}

export function formatPlanDayHuman(result: PlanDayApplied): string {
  const lines: string[] = []
  lines.push(`=== Plan Day: ${formatDayHeader(result.date)} ===`)
  lines.push('')
  if (result.weather) {
    lines.push(`Weather: ${result.weather.summary}`)
    lines.push(`  Outdoor score ${result.weather.outdoor_score}/100 — best window ${result.weather.best_outdoor_window}`)
  } else {
    lines.push('Weather: unavailable')
  }
  if (result.workout) {
    if (result.workout.rest_day) {
      lines.push(`Workout: ${result.workout.title} (rest day)`)
    } else {
      lines.push(`Workout: ${result.workout.title} (${result.workout.duration_minutes}m, ${result.workout.outdoor ? 'outdoor' : 'indoor'})`)
    }
  }
  lines.push(`Candidates: ${result.inboxCandidates} inbox, ${result.catalogCandidates} catalog`)
  lines.push('')

  for (let i = 0; i < result.plans.length; i++) {
    const plan = result.plans[i]
    const idx = i + 1
    lines.push(`Plan ${idx}: ${plan.archetype}`)
    lines.push(`  ${plan.rationale}`)
    for (const b of plan.blocks) {
      lines.push(formatPlanBlock(b))
    }
    const stats = `  — ${plan.scheduledMinutes}m scheduled, ${plan.freeMinutes}m free`
    const unplaced = plan.unplacedTaskCount > 0 ? `, ${plan.unplacedTaskCount} task(s) didn't fit` : ''
    lines.push(stats + unplaced)
    lines.push('')
  }

  if (result.applied) {
    lines.push(`Applied: ${result.applied.archetype} (${result.applied.blocksWritten} block${result.applied.blocksWritten === 1 ? '' : 's'} written to ${result.date})`)
  } else {
    lines.push(`To apply a plan: timebox plan-day --date ${result.date} --apply <1..${result.plans.length}>`)
  }

  return lines.join('\n')
}
