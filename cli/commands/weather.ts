import { WeatherData, HourlyWeather, DailyForecast } from '../types'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

// Open-Meteo's free forecast horizon is ~7 days starting today.
const FORECAST_HORIZON_DAYS = 7

const WEATHER_CODES: Record<number, string> = {
  0: 'clear sky',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'depositing rime fog',
  51: 'light drizzle',
  53: 'moderate drizzle',
  55: 'dense drizzle',
  61: 'slight rain',
  63: 'moderate rain',
  65: 'heavy rain',
  71: 'slight snow',
  73: 'moderate snow',
  75: 'heavy snow',
  80: 'slight rain showers',
  81: 'moderate rain showers',
  82: 'violent rain showers',
  95: 'thunderstorm',
  96: 'thunderstorm with slight hail',
  99: 'thunderstorm with heavy hail',
}

function computeOutdoorScore(
  tempHigh: number,
  tempLow: number,
  precipChance: number,
  windSpeed: number
): number {
  // Temperature comfort: 55-80F ideal, penalty outside that
  const avgTemp = (tempHigh + tempLow) / 2
  const tempScore = Math.max(0, 50 - Math.abs(avgTemp - 68)) / 50 * 40

  // Precipitation: lower is better
  const precipScore = Math.max(0, 100 - precipChance) / 100 * 40

  // Wind: under 15mph is fine, penalty above
  const windScore = Math.max(0, 30 - Math.max(0, windSpeed - 15)) / 30 * 20

  return Math.round(Math.min(100, Math.max(0, tempScore + precipScore + windScore)))
}

function findBestOutdoorWindow(hourly: HourlyWeather[]): string {
  if (hourly.length === 0) return 'midday (no hourly data available)'

  let bestHour: number | null = null
  let bestScore = -1

  for (const h of hourly) {
    const hour = parseInt(h.time.split('T')[1].split(':')[0])
    if (hour < 7 || hour > 19) continue

    const precipScore = Math.max(0, 100 - h.precipitation_probability)
    const tempScore = Math.max(0, 50 - Math.abs(h.temperature_f - 68))
    const score = precipScore * 2 + tempScore

    if (score > bestScore) {
      bestScore = score
      bestHour = hour
    }
  }

  if (bestHour !== null) {
    const endHour = bestHour + 1
    return `${bestHour.toString().padStart(2, '0')}:00-${endHour.toString().padStart(2, '0')}:00`
  }
  return 'midday'
}

export async function fetchWeather(): Promise<WeatherData> {
  const lat = process.env.OJ_LOCATION_LAT
  const lon = process.env.OJ_LOCATION_LON

  if (!lat || !lon) {
    throw new Error('OJ_LOCATION_LAT and OJ_LOCATION_LON environment variables are required')
  }

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,wind_speed_10m_max,sunrise,sunset',
    hourly: 'temperature_2m,precipitation_probability,weathercode',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: '1',
  })

  const response = await fetch(`${OPEN_METEO_URL}?${params}`)
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const daily = data.daily
  const hourlyRaw = data.hourly || {}

  const tempHigh: number = daily.temperature_2m_max[0]
  const tempLow: number = daily.temperature_2m_min[0]
  const precipChance: number = daily.precipitation_probability_max[0]
  const windSpeed: number = daily.wind_speed_10m_max[0]
  const weatherCode: number = daily.weathercode[0]
  const sunrise = daily.sunrise[0]?.split('T')[1] || ''
  const sunset = daily.sunset[0]?.split('T')[1] || ''

  const condition = WEATHER_CODES[weatherCode] || 'unknown'

  const hourly: HourlyWeather[] = (hourlyRaw.time || []).map((time: string, i: number) => ({
    time,
    temperature_f: hourlyRaw.temperature_2m?.[i] ?? 70,
    precipitation_probability: hourlyRaw.precipitation_probability?.[i] ?? 50,
    weather_code: hourlyRaw.weathercode?.[i] ?? 0,
  }))

  const outdoorScore = computeOutdoorScore(tempHigh, tempLow, precipChance, windSpeed)
  const bestOutdoorWindow = findBestOutdoorWindow(hourly)

  const summary = `${condition}, high ${Math.round(tempHigh)}F / low ${Math.round(tempLow)}F, ${precipChance}% chance of rain, wind ${Math.round(windSpeed)} mph`

  return {
    temperature_high_f: tempHigh,
    temperature_low_f: tempLow,
    condition,
    precipitation_chance: precipChance,
    wind_speed_mph: windSpeed,
    sunrise,
    sunset,
    best_outdoor_window: bestOutdoorWindow,
    outdoor_score: outdoorScore,
    summary,
    hourly,
  }
}

export async function fetchMultiDayWeather(days: number): Promise<DailyForecast[]> {
  const lat = process.env.OJ_LOCATION_LAT
  const lon = process.env.OJ_LOCATION_LON

  if (!lat || !lon) {
    throw new Error('OJ_LOCATION_LAT and OJ_LOCATION_LON environment variables are required')
  }

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,wind_speed_10m_max,sunrise,sunset',
    hourly: 'temperature_2m,precipitation_probability,weathercode',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: String(days),
  })

  const response = await fetch(`${OPEN_METEO_URL}?${params}`)
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const daily = data.daily
  const hourlyRaw = data.hourly || {}

  const forecasts: DailyForecast[] = []

  for (let i = 0; i < daily.time.length; i++) {
    const date: string = daily.time[i]
    const tempHigh: number = daily.temperature_2m_max[i]
    const tempLow: number = daily.temperature_2m_min[i]
    const precipChance: number = daily.precipitation_probability_max[i]
    const windSpeed: number = daily.wind_speed_10m_max[i]
    const weatherCode: number = daily.weathercode[i]
    const sunrise = daily.sunrise[i]?.split('T')[1] || ''
    const sunset = daily.sunset[i]?.split('T')[1] || ''
    const condition = WEATHER_CODES[weatherCode] || 'unknown'

    // Slice hourly data for this day (24 entries per day)
    const hourlyStart = i * 24
    const hourlyEnd = (i + 1) * 24
    const hourly: HourlyWeather[] = (hourlyRaw.time || [])
      .slice(hourlyStart, hourlyEnd)
      .map((time: string, j: number) => ({
        time,
        temperature_f: hourlyRaw.temperature_2m?.[hourlyStart + j] ?? 70,
        precipitation_probability: hourlyRaw.precipitation_probability?.[hourlyStart + j] ?? 50,
        weather_code: hourlyRaw.weathercode?.[hourlyStart + j] ?? 0,
      }))

    const outdoorScore = computeOutdoorScore(tempHigh, tempLow, precipChance, windSpeed)
    const bestOutdoorWindow = findBestOutdoorWindow(hourly)
    const summary = `${condition}, high ${Math.round(tempHigh)}F / low ${Math.round(tempLow)}F, ${precipChance}% chance of rain, wind ${Math.round(windSpeed)} mph`

    forecasts.push({
      date,
      temperature_high_f: tempHigh,
      temperature_low_f: tempLow,
      condition,
      precipitation_chance: precipChance,
      wind_speed_mph: windSpeed,
      sunrise,
      sunset,
      best_outdoor_window: bestOutdoorWindow,
      outdoor_score: outdoorScore,
      summary,
      hourly,
    })
  }

  return forecasts
}

/**
 * Weather for a specific calendar date. Open-Meteo with `timezone: 'auto'`
 * returns the location's local dates starting today, so we fetch the forecast
 * horizon and match the requested date against those dates directly — rather
 * than computing a day offset from the server clock, which may sit in a
 * different timezone than the location and misclassify the date. Returns null
 * for past dates or dates beyond the horizon, where no forecast exists.
 */
export async function fetchWeatherForDate(date: string): Promise<WeatherData | null> {
  const forecasts = await fetchMultiDayWeather(FORECAST_HORIZON_DAYS)
  return forecasts.find(f => f.date === date) ?? null
}

export function formatWeatherHuman(w: WeatherData): string {
  const lines = [
    `Weather: ${w.summary}`,
    `Outdoor score: ${w.outdoor_score}/100`,
    `Best outdoor window: ${w.best_outdoor_window}`,
    `Sunrise: ${w.sunrise} | Sunset: ${w.sunset}`,
  ]
  return lines.join('\n')
}

export function formatMultiDayWeatherHuman(forecasts: DailyForecast[]): string {
  const lines: string[] = [`${forecasts.length}-Day Forecast`, '']

  for (const f of forecasts) {
    const bar = '|'.repeat(Math.round(f.outdoor_score / 10))
    lines.push(`  ${f.date}  ${f.summary}`)
    lines.push(`             Outdoor: ${f.outdoor_score}/100 ${bar}  Best: ${f.best_outdoor_window}`)
  }

  return lines.join('\n')
}
