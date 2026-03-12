import { execSync } from 'child_process'
import { WorkoutData } from '../types'

const WORKOUT_CLI = '/home/michaelpawlus/projects/workout-app/backend/cli.py'

const OUTDOOR_TYPES = ['run', 'hike', 'bike', 'walk', 'trail', 'outdoor']

function isOutdoorWorkout(type: string, title: string): boolean {
  const combined = `${type} ${title}`.toLowerCase()
  return OUTDOOR_TYPES.some(t => combined.includes(t))
}

function isRestDay(type: string, title: string): boolean {
  const combined = `${type} ${title}`.toLowerCase()
  return combined.includes('rest') || combined.includes('cross-train') || combined.includes('off')
}

function estimateDuration(type: string, title: string, raw: Record<string, unknown>): number {
  // Check if the workout data includes duration info
  if (raw.duration_minutes && typeof raw.duration_minutes === 'number') {
    return raw.duration_minutes
  }
  if (raw.distance_miles && typeof raw.distance_miles === 'number') {
    // Rough estimate: 10 min/mile for runs, 20 min/mile for hikes
    const pace = type.toLowerCase().includes('hike') ? 20 : 10
    return Math.round((raw.distance_miles as number) * pace)
  }
  // Default durations by type
  const lower = `${type} ${title}`.toLowerCase()
  if (lower.includes('long run') || lower.includes('long hike')) return 120
  if (lower.includes('run') || lower.includes('hike')) return 60
  if (lower.includes('strength') || lower.includes('gym')) return 45
  if (lower.includes('yoga') || lower.includes('stretch')) return 30
  return 60
}

export async function fetchWorkout(): Promise<WorkoutData> {
  try {
    const output = execSync(`python3 ${WORKOUT_CLI} ultra today --json`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    const raw = JSON.parse(output)

    // Handle case where workout-app returns an error or not-found
    if (raw.error) {
      throw new Error(raw.error)
    }

    const title: string = raw.title || raw.workout || raw.name || 'Unknown workout'
    const type: string = raw.type || raw.workout_type || ''
    const description: string = raw.description || raw.notes || ''

    if (isRestDay(type, title)) {
      return {
        title,
        type,
        description,
        duration_minutes: 0,
        suggested_duration_minutes: 0,
        outdoor: false,
        rest_day: true,
        raw,
      }
    }

    const suggestedDuration = estimateDuration(type, title, raw)

    return {
      title,
      type,
      description,
      duration_minutes: suggestedDuration,
      suggested_duration_minutes: suggestedDuration,
      outdoor: isOutdoorWorkout(type, title),
      rest_day: false,
      raw,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`Failed to fetch workout: ${msg}`)
  }
}

export function formatWorkoutHuman(w: WorkoutData): string {
  if (w.rest_day) {
    return `Workout: ${w.title} (rest day - no workout block needed)`
  }
  const lines = [
    `Workout: ${w.title}`,
    `Type: ${w.type}${w.outdoor ? ' (outdoor)' : ' (indoor)'}`,
    `Duration: ~${w.suggested_duration_minutes} min`,
  ]
  if (w.description) lines.push(`Notes: ${w.description}`)
  return lines.join('\n')
}
