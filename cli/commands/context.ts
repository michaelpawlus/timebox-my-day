import { format } from 'date-fns'
import { ContextData, WeeklyContextData } from '../types'
import { fetchWeather, formatWeatherHuman, fetchMultiDayWeather, formatMultiDayWeatherHuman } from './weather'
import { fetchWorkout, formatWorkoutHuman } from './workout'
import { showSchedule, formatScheduleHuman } from './schedule'
import { showWeek, formatWeekHuman } from './week'
import { listItems, formatBacklogHuman } from './backlog'

export async function getContext(): Promise<ContextData> {
  const schedule = showSchedule()

  // Fetch weather and workout in parallel, gracefully handle failures
  const [weatherResult, workoutResult] = await Promise.allSettled([
    fetchWeather(),
    fetchWorkout(),
  ])

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null
  const workout = workoutResult.status === 'fulfilled' ? workoutResult.value : null

  if (weatherResult.status === 'rejected') {
    process.stderr.write(`Warning: Could not fetch weather: ${weatherResult.reason}\n`)
  }
  if (workoutResult.status === 'rejected') {
    process.stderr.write(`Warning: Could not fetch workout: ${workoutResult.reason}\n`)
  }

  return {
    date: schedule.date,
    weather,
    workout,
    schedule,
  }
}

export async function getWeeklyContext(date?: string): Promise<WeeklyContextData> {
  const target = date || format(new Date(), 'yyyy-MM-dd')
  const weekData = showWeek(target)
  const backlog = listItems()

  const [weatherResult] = await Promise.allSettled([
    fetchMultiDayWeather(7),
  ])

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null

  if (weatherResult.status === 'rejected') {
    process.stderr.write(`Warning: Could not fetch weather: ${weatherResult.reason}\n`)
  }

  return {
    weekOf: weekData.weekOf,
    weather,
    schedule: { weekOf: weekData.weekOf, days: weekData.days },
    backlog,
    dailyGaps: weekData.dailyGaps,
  }
}

export function formatContextHuman(ctx: ContextData): string {
  const lines: string[] = [
    `=== Day Context: ${ctx.date} ===`,
    '',
  ]

  if (ctx.weather) {
    lines.push(formatWeatherHuman(ctx.weather))
  } else {
    lines.push('Weather: unavailable')
  }
  lines.push('')

  if (ctx.workout) {
    lines.push(formatWorkoutHuman(ctx.workout))
  } else {
    lines.push('Workout: unavailable')
  }
  lines.push('')

  lines.push(formatScheduleHuman(ctx.schedule))

  return lines.join('\n')
}

export function formatWeeklyContextHuman(ctx: WeeklyContextData): string {
  const lines: string[] = [
    `=== Weekly Context: Week of ${ctx.weekOf} ===`,
    '',
  ]

  // Weather summary
  if (ctx.weather) {
    lines.push(formatMultiDayWeatherHuman(ctx.weather))
  } else {
    lines.push('Weather: unavailable')
  }
  lines.push('')

  // Backlog
  if (ctx.backlog.length > 0) {
    lines.push(formatBacklogHuman(ctx.backlog))
  } else {
    lines.push('Backlog: empty')
  }
  lines.push('')

  // Schedule
  lines.push(formatWeekHuman(ctx.schedule, ctx.dailyGaps))

  return lines.join('\n')
}
