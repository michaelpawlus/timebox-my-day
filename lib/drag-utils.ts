import { parseISO } from 'date-fns'

/**
 * Snap time (in minutes) to nearest interval
 * @param minutes Total minutes from start of day
 * @param interval Snap interval in minutes (default 15)
 */
export function snapToInterval(minutes: number, interval: number = 15): number {
  return Math.round(minutes / interval) * interval
}

/**
 * Convert Y position on timeline to time (in minutes from start of day)
 * @param yPosition Mouse Y position relative to timeline container
 * @param containerHeight Height of timeline container
 * @param startHour Timeline start hour (e.g., 8)
 * @param endHour Timeline end hour (e.g., 18)
 */
export function getTimeFromPosition(
  yPosition: number,
  containerHeight: number,
  startHour: number,
  endHour: number
): number {
  const totalHours = endHour - startHour
  const totalMinutes = totalHours * 60
  
  // Calculate percentage down the timeline
  const percentage = yPosition / containerHeight
  
  // Convert to minutes from start of timeline
  const minutesFromStart = percentage * totalMinutes
  
  // Add start hour offset to get absolute minutes from midnight
  const absoluteMinutes = startHour * 60 + minutesFromStart
  
  return snapToInterval(absoluteMinutes)
}

/**
 * Calculate new block times when dragging (moving the entire block)
 * @param dragStartY Initial mouse Y position when drag started
 * @param currentY Current mouse Y position
 * @param originalStart Original block start time (ISO string)
 * @param originalEnd Original block end time (ISO string)
 * @param containerHeight Height of timeline container
 * @param startHour Timeline start hour
 * @param endHour Timeline end hour
 * @param selectedDate Current selected date
 */
export function calculateDraggedTime(
  dragStartY: number,
  currentY: number,
  originalStart: string,
  originalEnd: string,
  containerHeight: number,
  startHour: number,
  endHour: number,
  selectedDate: Date
): { start: string; end: string } {
  // Calculate the offset in minutes
  const deltaY = currentY - dragStartY
  const totalHours = endHour - startHour
  const totalMinutes = totalHours * 60
  const deltaMinutes = (deltaY / containerHeight) * totalMinutes
  const snappedDelta = snapToInterval(deltaMinutes)
  
  // Apply offset to both start and end times
  const originalStartDate = parseISO(originalStart)
  const originalEndDate = parseISO(originalEnd)
  
  const newStartDate = new Date(originalStartDate)
  newStartDate.setMinutes(newStartDate.getMinutes() + snappedDelta)
  
  const newEndDate = new Date(originalEndDate)
  newEndDate.setMinutes(newEndDate.getMinutes() + snappedDelta)
  
  // Constrain to timeline bounds
  const constrainedStart = constrainToTimeline(
    newStartDate.toISOString(),
    startHour,
    endHour,
    selectedDate
  )
  
  // Calculate duration and apply to constrained start
  const duration = originalEndDate.getTime() - originalStartDate.getTime()
  const constrainedStartDate = parseISO(constrainedStart)
  const constrainedEndDate = new Date(constrainedStartDate.getTime() + duration)
  
  const constrainedEnd = constrainToTimeline(
    constrainedEndDate.toISOString(),
    startHour,
    endHour,
    selectedDate
  )
  
  return {
    start: constrainedStart,
    end: constrainedEnd,
  }
}

/**
 * Calculate new block times when resizing (adjusting start or end time)
 * @param mode 'resize-top' or 'resize-bottom'
 * @param currentY Current mouse Y position
 * @param originalStart Original block start time (ISO string)
 * @param originalEnd Original block end time (ISO string)
 * @param containerHeight Height of timeline container
 * @param startHour Timeline start hour
 * @param endHour Timeline end hour
 * @param selectedDate Current selected date
 */
export function calculateResizedTime(
  mode: 'resize-top' | 'resize-bottom',
  currentY: number,
  originalStart: string,
  originalEnd: string,
  containerHeight: number,
  startHour: number,
  endHour: number,
  selectedDate: Date
): { start: string; end: string } {
  const newTimeMinutes = getTimeFromPosition(
    currentY,
    containerHeight,
    startHour,
    endHour
  )
  
  const newDate = new Date(selectedDate)
  newDate.setHours(Math.floor(newTimeMinutes / 60))
  newDate.setMinutes(newTimeMinutes % 60)
  newDate.setSeconds(0)
  newDate.setMilliseconds(0)
  
  const originalStartDate = parseISO(originalStart)
  const originalEndDate = parseISO(originalEnd)
  
  if (mode === 'resize-top') {
    // Adjusting start time, keep end time fixed
    const minDuration = 15 // minimum 15 minutes
    const maxStart = new Date(originalEndDate)
    maxStart.setMinutes(maxStart.getMinutes() - minDuration)
    
    let newStart = newDate.toISOString()
    
    // Don't let start go past end (minus minimum duration)
    if (newDate > maxStart) {
      newStart = maxStart.toISOString()
    }
    
    // Constrain to timeline
    newStart = constrainToTimeline(newStart, startHour, endHour, selectedDate)
    
    return {
      start: newStart,
      end: originalEnd,
    }
  } else {
    // mode === 'resize-bottom'
    // Adjusting end time, keep start time fixed
    const minDuration = 15 // minimum 15 minutes
    const minEnd = new Date(originalStartDate)
    minEnd.setMinutes(minEnd.getMinutes() + minDuration)
    
    let newEnd = newDate.toISOString()
    
    // Don't let end go before start (plus minimum duration)
    if (newDate < minEnd) {
      newEnd = minEnd.toISOString()
    }
    
    // Constrain to timeline
    newEnd = constrainToTimeline(newEnd, startHour, endHour, selectedDate)
    
    return {
      start: originalStart,
      end: newEnd,
    }
  }
}

/**
 * Constrain a time to stay within timeline bounds
 * @param timeStr ISO time string
 * @param startHour Timeline start hour
 * @param endHour Timeline end hour
 * @param selectedDate Current selected date
 */
export function constrainToTimeline(
  timeStr: string,
  startHour: number,
  endHour: number,
  selectedDate: Date
): string {
  const time = parseISO(timeStr)
  const date = new Date(selectedDate)
  
  // Set minimum bound (start hour)
  const minTime = new Date(date)
  minTime.setHours(startHour, 0, 0, 0)
  
  // Set maximum bound (end hour)
  const maxTime = new Date(date)
  maxTime.setHours(endHour, 0, 0, 0)
  
  if (time < minTime) {
    return minTime.toISOString()
  }
  
  if (time > maxTime) {
    return maxTime.toISOString()
  }
  
  return timeStr
}

/**
 * Get duration in minutes between two times
 */
export function getDurationMinutes(start: string, end: string): number {
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
}

