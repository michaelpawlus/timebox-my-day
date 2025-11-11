import { format, parse, parseISO, isToday as isTodayFn, startOfDay, endOfDay } from 'date-fns'

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'HH:mm')
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM-dd')
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM-dd HH:mm')
}

export function parseDateTime(dateStr: string): Date {
  // Try ISO format first
  try {
    return parseISO(dateStr)
  } catch {
    // Fallback to other formats
    return parse(dateStr, 'yyyy-MM-dd HH:mm', new Date())
  }
}

export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isTodayFn(d)
}

export function getTimePosition(
  timeStr: string,
  startHour: number,
  endHour: number
): number {
  const time = parseISO(timeStr)
  const hours = time.getHours()
  const minutes = time.getMinutes()
  const totalMinutes = hours * 60 + minutes
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60
  const rangeMinutes = endMinutes - startMinutes

  const position = ((totalMinutes - startMinutes) / rangeMinutes) * 100
  return Math.max(0, Math.min(100, position))
}

export function getDuration(start: string, end: string): number {
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60) // minutes
}

export function getHeight(
  start: string,
  end: string,
  startHour: number,
  endHour: number
): number {
  const duration = getDuration(start, end)
  const totalMinutes = (endHour - startHour) * 60
  return (duration / totalMinutes) * 100
}

export function generateHourLabels(startHour: number, endHour: number): string[] {
  const labels: string[] = []
  for (let hour = startHour; hour <= endHour; hour++) {
    labels.push(`${hour.toString().padStart(2, '0')}:00`)
  }
  return labels
}

export function createISODateTime(date: Date, timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const newDate = new Date(date)
  newDate.setHours(hours, minutes, 0, 0)
  return newDate.toISOString()
}

export function isWithinDay(dateStr: string, targetDate: Date): boolean {
  const date = parseISO(dateStr)
  const dayStart = startOfDay(targetDate)
  const dayEnd = endOfDay(targetDate)
  return date >= dayStart && date <= dayEnd
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

