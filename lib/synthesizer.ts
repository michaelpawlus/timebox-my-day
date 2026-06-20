// Pure plan-day synthesizer — no IO. Shared by the CLI (cli/commands/plan-day.ts)
// and the Next.js web app (app/api/plan-day/route.ts). Callers gather the inputs
// (week store, Obsidian inbox, code catalog, weather, workout) and pass them in;
// this module turns them into 2-3 archetype day plans.

import { parseISO } from 'date-fns'
import { timeToMinutes, minutesToTime, isoToTime } from './week-utils'
import { BlockCategory, BusyEvent, PlanBlock } from './types'
import { DomainCategory, budgetFor, domainFromTags } from './time-budgets'
import type { InboxItem } from '../cli/inbox-store'
import type { CatalogIssue, ImpactScore, LoeScore } from '../cli/catalog-store'
import type { WeatherData, WorkoutData } from '../cli/types'

const DAY_START = '07:00'
const DAY_END = '21:00'
const LUNCH_START = '12:00'
const LUNCH_END = '12:30'
const OUTDOOR_SCORE_THRESHOLD = 60

const PRIORITY_RANK: Record<'hard' | 'soft' | 'none', number> = { hard: 0, soft: 1, none: 2 }
const LOE_RANK: Record<LoeScore, number> = { S: 0, M: 1, L: 2, XL: 3 }
const IMPACT_RANK: Record<ImpactScore, number> = { high: 0, med: 1, low: 2 }
const LOE_DURATIONS: Record<LoeScore, number> = { S: 30, M: 60, L: 90, XL: 120 }

const MAX_CATALOG_TASKS = 4
const MIN_DEEP_FOCUS = 90       // minutes — what counts as a "deep" focus block
const QUICK_TASK_MAX = 30       // minutes — what counts as a "quick" task for bundling

export type ArchetypeId = 'deep-focus-am' | 'errand-sweep' | 'outdoor-optimized'

interface PlanTask {
  id: string
  source: 'inbox' | 'catalog' | 'workout'
  ref?: string
  title: string
  category: BlockCategory
  domain: DomainCategory
  core: number
  prep: number
  recovery: number
  total: number
  priority: 'hard' | 'soft' | 'none'
  deadline?: string
  outdoor: boolean
  weekendOnly: boolean
  loe?: LoeScore
  impact?: ImpactScore
}

export interface PlanBlockDraft {
  start: string
  end: string
  durationMinutes: number
  title: string
  category: BlockCategory
  source: 'busy' | 'lunch' | 'inbox' | 'catalog' | 'workout' | 'existing-plan'
  ref?: string
  notes?: string
}

export interface ArchetypePlan {
  id: ArchetypeId
  archetype: string
  rationale: string
  blocks: PlanBlockDraft[]
  newBlocks: PlanBlockDraft[]
  scheduledMinutes: number
  freeMinutes: number
  unplacedTaskCount: number
}

export interface PlanDayResult {
  date: string
  weekOf: string
  weather: {
    summary: string
    outdoor_score: number
    best_outdoor_window: string
  } | null
  workout: {
    title: string
    type: string
    duration_minutes: number
    outdoor: boolean
    rest_day: boolean
  } | null
  inboxCandidates: number
  catalogCandidates: number
  plans: ArchetypePlan[]
}

// ---------- Task building ----------

function isWeekendDate(dateStr: string): boolean {
  const d = parseISO(dateStr)
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

function parseDurationField(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function parseBufferField(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function parsePriority(v: string | undefined): 'hard' | 'soft' | 'none' {
  if (v === 'hard' || v === 'soft' || v === 'none') return v
  return 'none'
}

function inboxItemToTask(item: InboxItem): PlanTask {
  const domain = domainFromTags(item.tags)
  const core = parseDurationField(item.fields.duration) ?? 30
  const budgetOverride = parseBufferField(item.fields.buffer)
  const budget = budgetFor(domain, budgetOverride)
  const outdoor = item.tags.includes('outdoor')
  const weekendOnly = item.tags.includes('weekend')
  const priority = parsePriority(item.fields.priority)
  const category: BlockCategory =
    domain === 'exercise' ? 'exercise' :
    domain === 'meeting' ? 'meeting' :
    domain === 'learning' || domain === 'code' ? 'focus' :
    'other'

  return {
    id: `inbox:${item.id}`,
    source: 'inbox',
    ref: item.id,
    title: item.title,
    category,
    domain,
    core,
    prep: budget.prep,
    recovery: budget.recovery,
    total: core + budget.prep + budget.recovery,
    priority,
    deadline: item.fields.deadline,
    outdoor,
    weekendOnly,
  }
}

function catalogIssueToTask(issue: CatalogIssue): PlanTask {
  const core = LOE_DURATIONS[issue.loe]
  const budget = budgetFor('code')
  const priority: 'hard' | 'soft' | 'none' = issue.impact === 'high' ? 'hard' : 'soft'
  return {
    id: `catalog:${issue.id}`,
    source: 'catalog',
    ref: issue.id,
    title: `${issue.repo.split('/').pop()}#${issue.number}: ${issue.title}`,
    category: 'focus',
    domain: 'code',
    core,
    prep: budget.prep,
    recovery: budget.recovery,
    total: core + budget.prep + budget.recovery,
    priority,
    outdoor: false,
    weekendOnly: false,
    loe: issue.loe,
    impact: issue.impact,
  }
}

function workoutToTask(workout: WorkoutData): PlanTask | null {
  if (workout.rest_day) return null
  const core = workout.duration_minutes || workout.suggested_duration_minutes || 45
  if (core <= 0) return null
  const budget = budgetFor('exercise')
  return {
    id: 'workout',
    source: 'workout',
    title: `Workout: ${workout.title}`,
    category: 'exercise',
    domain: 'exercise',
    core,
    prep: budget.prep,
    recovery: budget.recovery,
    total: core + budget.prep + budget.recovery,
    priority: 'soft',
    outdoor: workout.outdoor,
    weekendOnly: false,
  }
}

function filterTasksForDate(tasks: PlanTask[], dateStr: string): PlanTask[] {
  const weekend = isWeekendDate(dateStr)
  return tasks.filter(t => {
    if (t.weekendOnly && !weekend) return false
    return true
  })
}

// ---------- Gap management ----------

interface GapMin {
  startMin: number
  endMin: number
}

function gapDuration(g: GapMin): number {
  return g.endMin - g.startMin
}

function overlaps(a: GapMin, b: GapMin): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin
}

function computeGapsFromReservations(reservations: GapMin[]): GapMin[] {
  const dayStart = timeToMinutes(DAY_START)
  const dayEnd = timeToMinutes(DAY_END)
  const sorted = [...reservations].sort((a, b) => a.startMin - b.startMin)
  const merged: GapMin[] = []
  for (const r of sorted) {
    if (merged.length > 0 && r.startMin <= merged[merged.length - 1].endMin) {
      merged[merged.length - 1].endMin = Math.max(merged[merged.length - 1].endMin, r.endMin)
    } else {
      merged.push({ startMin: r.startMin, endMin: r.endMin })
    }
  }
  const gaps: GapMin[] = []
  let cursor = dayStart
  for (const r of merged) {
    const s = Math.max(r.startMin, dayStart)
    const e = Math.min(r.endMin, dayEnd)
    if (cursor < s) gaps.push({ startMin: cursor, endMin: s })
    cursor = Math.max(cursor, e)
  }
  if (cursor < dayEnd) gaps.push({ startMin: cursor, endMin: dayEnd })
  return gaps
}

function placeAtStart(gaps: GapMin[], gapIndex: number, total: number): { startMin: number; endMin: number; gaps: GapMin[] } {
  const g = gaps[gapIndex]
  const placement = { startMin: g.startMin, endMin: g.startMin + total }
  const remaining = placement.endMin < g.endMin
    ? [{ startMin: placement.endMin, endMin: g.endMin }]
    : []
  const next = [...gaps.slice(0, gapIndex), ...remaining, ...gaps.slice(gapIndex + 1)]
  return { startMin: placement.startMin, endMin: placement.endMin, gaps: next }
}

function placeAt(gaps: GapMin[], gapIndex: number, startMin: number, total: number): { startMin: number; endMin: number; gaps: GapMin[] } {
  const g = gaps[gapIndex]
  const endMin = startMin + total
  const left = startMin > g.startMin ? [{ startMin: g.startMin, endMin: startMin }] : []
  const right = endMin < g.endMin ? [{ startMin: endMin, endMin: g.endMin }] : []
  const next = [...gaps.slice(0, gapIndex), ...left, ...right, ...gaps.slice(gapIndex + 1)]
  return { startMin, endMin, gaps: next }
}

// ---------- Archetype helpers ----------

function firstFittingGap(gaps: GapMin[], total: number, prefer: 'am' | 'pm' | 'any'): number {
  const noon = timeToMinutes('12:00')
  // Build list of indices with capacity, sorted by preference
  const indices = gaps
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => gapDuration(g) >= total)
  if (indices.length === 0) return -1
  if (prefer === 'am') {
    const am = indices.filter(({ g }) => g.startMin < noon)
    if (am.length > 0) {
      am.sort((a, b) => b.g.endMin - b.g.startMin - (a.g.endMin - a.g.startMin))
      return am[0].i
    }
  }
  if (prefer === 'pm') {
    const pm = indices.filter(({ g }) => g.startMin >= noon)
    if (pm.length > 0) {
      pm.sort((a, b) => b.g.endMin - b.g.startMin - (a.g.endMin - a.g.startMin))
      return pm[0].i
    }
  }
  indices.sort((a, b) => a.g.startMin - b.g.startMin)
  return indices[0].i
}

function largestGap(gaps: GapMin[], filter: 'am' | 'pm' | 'any' = 'any'): number {
  const noon = timeToMinutes('12:00')
  let bestIdx = -1
  let bestSize = 0
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i]
    if (filter === 'am' && g.startMin >= noon) continue
    if (filter === 'pm' && g.startMin < noon) continue
    const sz = gapDuration(g)
    if (sz > bestSize) { bestSize = sz; bestIdx = i }
  }
  return bestIdx
}

function gapContainingTime(gaps: GapMin[], targetMin: number): number {
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i].startMin <= targetMin && gaps[i].endMin > targetMin) return i
  }
  return -1
}

function parseWindow(window: string): { startMin: number; endMin: number } | null {
  const m = window.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)
  if (!m) return null
  return {
    startMin: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
    endMin: parseInt(m[3], 10) * 60 + parseInt(m[4], 10),
  }
}

// ---------- Archetype builders ----------

interface BuildContext {
  date: string
  busy: BusyEvent[]
  existingPlanBlocks: PlanBlock[]
  weather: WeatherData | null
  tasks: PlanTask[]
}

interface FixedBlocks {
  reservations: GapMin[]
  fixedDrafts: PlanBlockDraft[]
}

function buildFixedBlocks(ctx: BuildContext): FixedBlocks {
  const reservations: GapMin[] = []
  const fixedDrafts: PlanBlockDraft[] = []

  // Existing plan blocks treated as fixed anchors
  for (const b of ctx.existingPlanBlocks) {
    const startMin = timeToMinutes(isoToTime(b.start))
    const endMin = timeToMinutes(isoToTime(b.end))
    reservations.push({ startMin, endMin })
    fixedDrafts.push({
      start: minutesToTime(startMin),
      end: minutesToTime(endMin),
      durationMinutes: endMin - startMin,
      title: b.title,
      category: b.category || 'other',
      source: 'existing-plan',
      notes: b.notes,
    })
  }

  // Busy events
  for (const e of ctx.busy) {
    if (e.allDay) continue
    const startMin = timeToMinutes(isoToTime(e.start))
    const endMin = timeToMinutes(isoToTime(e.end))
    reservations.push({ startMin, endMin })
    fixedDrafts.push({
      start: minutesToTime(startMin),
      end: minutesToTime(endMin),
      durationMinutes: endMin - startMin,
      title: e.title,
      category: 'meeting',
      source: 'busy',
      notes: e.location,
    })
  }

  // Lunch reservation if nothing overlaps 12:00-12:30
  const lunchSlot: GapMin = { startMin: timeToMinutes(LUNCH_START), endMin: timeToMinutes(LUNCH_END) }
  if (!reservations.some(r => overlaps(r, lunchSlot))) {
    reservations.push(lunchSlot)
    fixedDrafts.push({
      start: LUNCH_START,
      end: LUNCH_END,
      durationMinutes: lunchSlot.endMin - lunchSlot.startMin,
      title: 'Lunch',
      category: 'meal',
      source: 'lunch',
    })
  }

  return { reservations, fixedDrafts }
}

function draftFromTask(task: PlanTask, startMin: number): PlanBlockDraft {
  return {
    start: minutesToTime(startMin),
    end: minutesToTime(startMin + task.total),
    durationMinutes: task.total,
    title: task.title,
    category: task.category,
    source: task.source,
    ref: task.ref,
    notes: task.prep + task.recovery > 0
      ? `core ${task.core}m + prep ${task.prep}m + recovery ${task.recovery}m`
      : undefined,
  }
}

function summarizePlan(fixed: PlanBlockDraft[], placed: PlanBlockDraft[]): { scheduledMinutes: number; freeMinutes: number } {
  const reservations = [...fixed, ...placed].map(b => ({
    startMin: timeToMinutes(b.start),
    endMin: timeToMinutes(b.end),
  }))
  const gaps = computeGapsFromReservations(reservations)
  const freeMinutes = gaps.reduce((sum, g) => sum + gapDuration(g), 0)
  const dayMinutes = timeToMinutes(DAY_END) - timeToMinutes(DAY_START)
  return { scheduledMinutes: dayMinutes - freeMinutes, freeMinutes }
}

// Sort by priority then by deadline then by impact (catalog) then by duration desc
function priorityOrder(a: PlanTask, b: PlanTask): number {
  const pa = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (pa !== 0) return pa
  const da = a.deadline || '9999-12-31'
  const db = b.deadline || '9999-12-31'
  if (da !== db) return da < db ? -1 : 1
  if (a.source === 'catalog' && b.source === 'catalog') {
    const ia = IMPACT_RANK[a.impact || 'med'] - IMPACT_RANK[b.impact || 'med']
    if (ia !== 0) return ia
  }
  return b.total - a.total
}

function buildDeepFocusAM(ctx: BuildContext): ArchetypePlan {
  const { reservations, fixedDrafts } = buildFixedBlocks(ctx)
  let gaps = computeGapsFromReservations(reservations)
  const placed: PlanBlockDraft[] = []
  const remainingTasks: PlanTask[] = []

  // First, place the workout if any (anchor early evening if morning gap is short)
  const workoutTask = ctx.tasks.find(t => t.source === 'workout')
  const longTasks = ctx.tasks
    .filter(t => t.source !== 'workout' && t.total >= MIN_DEEP_FOCUS)
    .sort(priorityOrder)
  const shortTasks = ctx.tasks
    .filter(t => t.source !== 'workout' && t.total < MIN_DEEP_FOCUS)
    .sort(priorityOrder)

  // Try to place workout
  if (workoutTask) {
    const idx = firstFittingGap(gaps, workoutTask.total, 'pm')
    const useIdx = idx >= 0 ? idx : firstFittingGap(gaps, workoutTask.total, 'any')
    if (useIdx >= 0) {
      const r = placeAtStart(gaps, useIdx, workoutTask.total)
      placed.push(draftFromTask(workoutTask, r.startMin))
      gaps = r.gaps
    } else {
      remainingTasks.push(workoutTask)
    }
  }

  // Place 1-2 deep blocks in the AM
  let deepPlaced = 0
  for (const task of longTasks) {
    if (deepPlaced >= 2) {
      remainingTasks.push(task)
      continue
    }
    const idx = firstFittingGap(gaps, task.total, 'am')
    if (idx < 0) {
      const anyIdx = firstFittingGap(gaps, task.total, 'any')
      if (anyIdx >= 0) {
        const r = placeAtStart(gaps, anyIdx, task.total)
        placed.push(draftFromTask(task, r.startMin))
        gaps = r.gaps
        deepPlaced++
      } else {
        remainingTasks.push(task)
      }
    } else {
      const r = placeAtStart(gaps, idx, task.total)
      placed.push(draftFromTask(task, r.startMin))
      gaps = r.gaps
      deepPlaced++
    }
  }

  // Fill remaining gaps with short tasks (afternoon preferred)
  for (const task of shortTasks) {
    const idx = firstFittingGap(gaps, task.total, 'pm')
    const useIdx = idx >= 0 ? idx : firstFittingGap(gaps, task.total, 'any')
    if (useIdx < 0) {
      remainingTasks.push(task)
      continue
    }
    const r = placeAtStart(gaps, useIdx, task.total)
    placed.push(draftFromTask(task, r.startMin))
    gaps = r.gaps
  }

  const allBlocks = [...fixedDrafts, ...placed].sort(byStart)
  const summary = summarizePlan(fixedDrafts, placed)
  const rationale = composeDeepFocusRationale(ctx, placed)

  return {
    id: 'deep-focus-am',
    archetype: 'Deep Focus AM',
    rationale,
    blocks: allBlocks,
    newBlocks: placed,
    scheduledMinutes: summary.scheduledMinutes,
    freeMinutes: summary.freeMinutes,
    unplacedTaskCount: remainingTasks.length,
  }
}

function buildErrandSweep(ctx: BuildContext): ArchetypePlan {
  const { reservations, fixedDrafts } = buildFixedBlocks(ctx)
  let gaps = computeGapsFromReservations(reservations)
  const placed: PlanBlockDraft[] = []
  const remainingTasks: PlanTask[] = []

  const workoutTask = ctx.tasks.find(t => t.source === 'workout')
  const quickTasks = ctx.tasks
    .filter(t => t.source !== 'workout' && t.total <= QUICK_TASK_MAX + 15)
    .sort(priorityOrder)
  const otherTasks = ctx.tasks
    .filter(t => t.source !== 'workout' && t.total > QUICK_TASK_MAX + 15)
    .sort(priorityOrder)

  // Workout placed in best-fit AM slot first (errands aren't time-sensitive)
  if (workoutTask) {
    const idx = firstFittingGap(gaps, workoutTask.total, 'am')
    const useIdx = idx >= 0 ? idx : firstFittingGap(gaps, workoutTask.total, 'any')
    if (useIdx >= 0) {
      const r = placeAtStart(gaps, useIdx, workoutTask.total)
      placed.push(draftFromTask(workoutTask, r.startMin))
      gaps = r.gaps
    } else {
      remainingTasks.push(workoutTask)
    }
  }

  // Bundle quick tasks into AM gaps
  for (const task of quickTasks) {
    const idx = firstFittingGap(gaps, task.total, 'am')
    const useIdx = idx >= 0 ? idx : firstFittingGap(gaps, task.total, 'any')
    if (useIdx < 0) { remainingTasks.push(task); continue }
    const r = placeAtStart(gaps, useIdx, task.total)
    placed.push(draftFromTask(task, r.startMin))
    gaps = r.gaps
  }

  // Reserve the largest PM gap as a single focus block from a long task
  const pmIdx = largestGap(gaps, 'pm')
  if (pmIdx >= 0 && otherTasks.length > 0) {
    const pmGap = gaps[pmIdx]
    // Find the longest task that fits the PM gap
    const fitting = otherTasks.filter(t => t.total <= gapDuration(pmGap))
    if (fitting.length > 0) {
      fitting.sort((a, b) => b.total - a.total)
      const chosen = fitting[0]
      const r = placeAtStart(gaps, pmIdx, chosen.total)
      placed.push(draftFromTask(chosen, r.startMin))
      gaps = r.gaps
      otherTasks.splice(otherTasks.indexOf(chosen), 1)
    }
  }

  // Fill any remaining gaps with remaining tasks
  for (const task of otherTasks) {
    const idx = firstFittingGap(gaps, task.total, 'any')
    if (idx < 0) { remainingTasks.push(task); continue }
    const r = placeAtStart(gaps, idx, task.total)
    placed.push(draftFromTask(task, r.startMin))
    gaps = r.gaps
  }

  const allBlocks = [...fixedDrafts, ...placed].sort(byStart)
  const summary = summarizePlan(fixedDrafts, placed)
  const rationale = composeErrandRationale(ctx, placed, quickTasks.length)

  return {
    id: 'errand-sweep',
    archetype: 'Errand Sweep',
    rationale,
    blocks: allBlocks,
    newBlocks: placed,
    scheduledMinutes: summary.scheduledMinutes,
    freeMinutes: summary.freeMinutes,
    unplacedTaskCount: remainingTasks.length,
  }
}

function buildOutdoorOptimized(ctx: BuildContext): ArchetypePlan | null {
  if (!ctx.weather || ctx.weather.outdoor_score < OUTDOOR_SCORE_THRESHOLD) return null

  const window = parseWindow(ctx.weather.best_outdoor_window)
  const { reservations, fixedDrafts } = buildFixedBlocks(ctx)
  let gaps = computeGapsFromReservations(reservations)
  const placed: PlanBlockDraft[] = []
  const remainingTasks: PlanTask[] = []

  const outdoorTasks = ctx.tasks
    .filter(t => t.outdoor)
    .sort(priorityOrder)
  const indoorTasks = ctx.tasks
    .filter(t => !t.outdoor)
    .sort(priorityOrder)

  // No outdoor tasks → don't generate this archetype
  if (outdoorTasks.length === 0) return null

  // Place the highest-priority outdoor task at the start of the weather window
  const primary = outdoorTasks[0]
  let anchored = false
  if (window) {
    const idx = gapContainingTime(gaps, window.startMin)
    if (idx >= 0 && gapDuration(gaps[idx]) >= primary.total && gaps[idx].endMin - window.startMin >= primary.total) {
      const r = placeAt(gaps, idx, window.startMin, primary.total)
      placed.push(draftFromTask(primary, r.startMin))
      gaps = r.gaps
      anchored = true
    }
  }
  if (!anchored) {
    const idx = firstFittingGap(gaps, primary.total, 'any')
    if (idx >= 0) {
      const r = placeAtStart(gaps, idx, primary.total)
      placed.push(draftFromTask(primary, r.startMin))
      gaps = r.gaps
    } else {
      remainingTasks.push(primary)
    }
  }

  // Remaining outdoor tasks: place earliest fit
  for (const task of outdoorTasks.slice(1)) {
    const idx = firstFittingGap(gaps, task.total, 'any')
    if (idx < 0) { remainingTasks.push(task); continue }
    const r = placeAtStart(gaps, idx, task.total)
    placed.push(draftFromTask(task, r.startMin))
    gaps = r.gaps
  }

  // Then indoor tasks (priority order)
  for (const task of indoorTasks) {
    const idx = firstFittingGap(gaps, task.total, 'any')
    if (idx < 0) { remainingTasks.push(task); continue }
    const r = placeAtStart(gaps, idx, task.total)
    placed.push(draftFromTask(task, r.startMin))
    gaps = r.gaps
  }

  const allBlocks = [...fixedDrafts, ...placed].sort(byStart)
  const summary = summarizePlan(fixedDrafts, placed)
  const rationale = composeOutdoorRationale(ctx, placed)

  return {
    id: 'outdoor-optimized',
    archetype: 'Outdoor Optimized',
    rationale,
    blocks: allBlocks,
    newBlocks: placed,
    scheduledMinutes: summary.scheduledMinutes,
    freeMinutes: summary.freeMinutes,
    unplacedTaskCount: remainingTasks.length,
  }
}

function byStart(a: PlanBlockDraft, b: PlanBlockDraft): number {
  return timeToMinutes(a.start) - timeToMinutes(b.start)
}

// ---------- Rationale generators ----------

function composeDeepFocusRationale(ctx: BuildContext, placed: PlanBlockDraft[]): string {
  const deepCount = placed.filter(b => b.durationMinutes >= MIN_DEEP_FOCUS && b.category === 'focus').length
  const meetings = ctx.busy.filter(e => !e.allDay).length
  if (deepCount >= 2) return `Two deep blocks before midday; light tasks bundled in the afternoon.`
  if (deepCount === 1) return `One ${MIN_DEEP_FOCUS}+ min focus block in the morning; ${meetings} meeting${meetings === 1 ? '' : 's'} after.`
  if (meetings > 0) return `Limited morning space (${meetings} meeting${meetings === 1 ? '' : 's'}); focus where it fits, errands fill in.`
  return `No long focus items in the backlog — short tasks placed across the day.`
}

function composeErrandRationale(ctx: BuildContext, placed: PlanBlockDraft[], quickCount: number): string {
  const pmFocus = placed.find(b => timeToMinutes(b.start) >= timeToMinutes('12:00') && b.durationMinutes >= MIN_DEEP_FOCUS)
  if (pmFocus && quickCount > 0) return `${quickCount} quick task${quickCount === 1 ? '' : 's'} bundled in the morning; long focus block in the afternoon.`
  if (pmFocus) return `Afternoon reserved for a single focus block; morning kept clear.`
  if (quickCount > 0) return `Morning swept for ${quickCount} quick task${quickCount === 1 ? '' : 's'}; no PM focus block fit.`
  return `Few quick tasks available — sweep stays shallow.`
}

function composeOutdoorRationale(ctx: BuildContext, _placed: PlanBlockDraft[]): string {
  const score = ctx.weather?.outdoor_score ?? 0
  const window = ctx.weather?.best_outdoor_window ?? 'midday'
  return `Outdoor score ${score}/100, best window ${window}; outdoor task anchored there, indoor work fills around.`
}

// ---------- Top-level synthesizer (pure) ----------

export interface SynthesizeInput {
  date: string                      // YYYY-MM-DD
  weekOf: string                    // Monday YYYY-MM-DD
  busy: BusyEvent[]
  existingPlanBlocks: PlanBlock[]
  weather: WeatherData | null
  workout: WorkoutData | null
  inboxItems: InboxItem[]           // already filtered to active (not done)
  catalogIssues: CatalogIssue[]
}

/**
 * Turn gathered planning inputs into 2-3 archetype day plans. Pure: all IO
 * (reading the week store / inbox / catalog, fetching weather + workout) happens
 * in the caller. Shared by the CLI and the web API route.
 */
export function synthesizeDay(input: SynthesizeInput): PlanDayResult {
  const inboxTasks = input.inboxItems.map(inboxItemToTask)

  const rankedCatalog = [...input.catalogIssues]
    .filter(i => LOE_RANK[i.loe] <= LOE_RANK['L'])
    .sort((a, b) => {
      const ia = IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact]
      if (ia !== 0) return ia
      return LOE_RANK[a.loe] - LOE_RANK[b.loe]
    })
    .slice(0, MAX_CATALOG_TASKS)
  const catalogTasks = rankedCatalog.map(catalogIssueToTask)

  const workoutTask = input.workout ? workoutToTask(input.workout) : null
  const baseTasks: PlanTask[] = [
    ...(workoutTask ? [workoutTask] : []),
    ...inboxTasks,
    ...catalogTasks,
  ]
  const tasks = filterTasksForDate(baseTasks, input.date)

  const ctx: BuildContext = {
    date: input.date,
    busy: input.busy,
    existingPlanBlocks: input.existingPlanBlocks,
    weather: input.weather,
    tasks,
  }

  const plans: ArchetypePlan[] = [
    buildDeepFocusAM(ctx),
    buildErrandSweep(ctx),
  ]
  const outdoor = buildOutdoorOptimized(ctx)
  if (outdoor) plans.push(outdoor)

  return {
    date: input.date,
    weekOf: input.weekOf,
    weather: input.weather
      ? { summary: input.weather.summary, outdoor_score: input.weather.outdoor_score, best_outdoor_window: input.weather.best_outdoor_window }
      : null,
    workout: input.workout
      ? { title: input.workout.title, type: input.workout.type, duration_minutes: input.workout.duration_minutes, outdoor: input.workout.outdoor, rest_day: input.workout.rest_day }
      : null,
    inboxCandidates: inboxTasks.length,
    catalogCandidates: catalogTasks.length,
    plans,
  }
}
