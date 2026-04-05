import { BusyEvent, PlanBlock, UnscheduledBlock, BacklogItem, Gap } from '../lib/types'

// Re-export Gap from lib for backward compatibility
export type { Gap }

export interface WeatherData {
  temperature_high_f: number
  temperature_low_f: number
  condition: string
  precipitation_chance: number
  wind_speed_mph: number
  sunrise: string
  sunset: string
  best_outdoor_window: string
  outdoor_score: number
  summary: string
  hourly: HourlyWeather[]
}

export interface HourlyWeather {
  time: string
  temperature_f: number
  precipitation_probability: number
  weather_code: number
}

export interface WorkoutData {
  title: string
  type: string
  description: string
  duration_minutes: number
  suggested_duration_minutes: number
  outdoor: boolean
  rest_day: boolean
  raw: Record<string, unknown>
}

export interface DaySchedule {
  date: string    // YYYY-MM-DD
  busy_events: BusyEvent[]
  plan_blocks: PlanBlock[]
  unscheduled_blocks: UnscheduledBlock[]
}

export interface ScheduleView {
  date: string
  day_start: string
  day_end: string
  busy_events: BusyEvent[]
  plan_blocks: PlanBlock[]
  unscheduled_blocks: UnscheduledBlock[]
  gaps: Gap[]
  total_scheduled_minutes: number
  total_free_minutes: number
}

export interface ContextData {
  date: string
  weather: WeatherData | null
  workout: WorkoutData | null
  schedule: ScheduleView
}

// Weekly planning types

export interface Backlog {
  items: BacklogItem[]
}

export interface DayPlan {
  date: string
  busyEvents: BusyEvent[]
  planBlocks: PlanBlock[]
}

export interface WeekSchedule {
  weekOf: string                    // Monday YYYY-MM-DD
  days: Record<string, DayPlan>     // keyed by YYYY-MM-DD
}

export interface DailyForecast {
  date: string
  temperature_high_f: number
  temperature_low_f: number
  condition: string
  precipitation_chance: number
  wind_speed_mph: number
  sunrise: string
  sunset: string
  best_outdoor_window: string
  outdoor_score: number
  summary: string
  hourly: HourlyWeather[]
}

export interface DayGaps {
  date: string
  gaps: Gap[]
  total_free_minutes: number
  total_scheduled_minutes: number
}

export interface WeeklyContextData {
  weekOf: string
  weather: DailyForecast[] | null
  schedule: WeekSchedule
  backlog: BacklogItem[]
  dailyGaps: DayGaps[]
}
