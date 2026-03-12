import { ContextData } from '../types'
import { fetchWeather, formatWeatherHuman } from './weather'
import { fetchWorkout, formatWorkoutHuman } from './workout'
import { showSchedule, formatScheduleHuman } from './schedule'

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
