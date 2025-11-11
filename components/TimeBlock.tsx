'use client'

import React from 'react'
import { BusyEvent, PlanBlock } from '@/lib/types'
import { getTimePosition, getHeight, formatTime, parseISO } from '@/lib/time'

interface TimeBlockProps {
  event: BusyEvent | PlanBlock
  type: 'busy' | 'plan'
  startHour: number
  endHour: number
  onClick?: () => void
  hasConflict?: boolean
}

export default function TimeBlock({
  event,
  type,
  startHour,
  endHour,
  onClick,
  hasConflict = false,
}: TimeBlockProps) {
  const top = getTimePosition(event.start, startHour, endHour)
  const height = getHeight(event.start, event.end, startHour, endHour)
  
  const startTime = formatTime(event.start)
  const endTime = formatTime(event.end)

  const baseStyles = 'absolute left-0 right-0 mx-1 rounded-md px-2 py-1 text-sm overflow-hidden transition-all cursor-pointer'
  const typeStyles = type === 'busy' 
    ? 'bg-gray-200 text-gray-700 border border-gray-300'
    : 'bg-blue-500 text-white border-2 border-blue-600 hover:bg-blue-600'
  
  const conflictStyles = hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''

  return (
    <div
      className={`${baseStyles} ${typeStyles} ${conflictStyles}`}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        minHeight: '30px',
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.()
        }
      }}
      aria-label={`${type === 'busy' ? 'Busy' : 'Plan'} block: ${event.title} from ${startTime} to ${endTime}`}
    >
      <div className="font-semibold truncate">{event.title}</div>
      <div className="text-xs opacity-90">
        {startTime} - {endTime}
      </div>
      {event.location && (
        <div className="text-xs opacity-75 truncate">📍 {event.location}</div>
      )}
    </div>
  )
}

