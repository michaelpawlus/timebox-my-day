'use client'

import React from 'react'
import { BusyEvent, PlanBlock } from '@/lib/types'
import { getTimePosition, getHeight, formatTime } from '@/lib/time'
import { useTimeBoxStore } from '@/lib/store'
import { darkenColor, lightenColor } from '@/lib/categories'

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
  const { startDrag, isDragging, draggedBlockId } = useTimeBoxStore()

  const top = getTimePosition(event.start, startHour, endHour)
  const height = getHeight(event.start, event.end, startHour, endHour)

  const startTime = formatTime(event.start)
  const endTime = formatTime(event.end)

  const isBeingDragged = isDragging && draggedBlockId === event.id
  const isPlanBlock = type === 'plan'

  // Get block color for plan blocks
  const blockColor = isPlanBlock ? (event as PlanBlock).color || '#3b82f6' : undefined

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isPlanBlock) return

    // Prevent if clicking on resize handle
    const target = e.target as HTMLElement
    if (target.classList.contains('resize-handle')) return

    e.stopPropagation()
    startDrag(event.id, 'move', event.start, event.end)
  }

  const handleResizeTopMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    startDrag(event.id, 'resize-top', event.start, event.end)
  }

  const handleResizeBottomMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    startDrag(event.id, 'resize-bottom', event.start, event.end)
  }

  const baseStyles = 'absolute left-0 right-0 mx-1 rounded-md px-2 py-1 text-sm overflow-hidden transition-all'
  const conflictStyles = hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''
  const dragStyles = isBeingDragged ? 'opacity-70 border-dashed' : ''

  // Plan blocks use dynamic color via inline styles; busy blocks use Tailwind classes
  const typeStyles = type === 'busy'
    ? 'bg-gray-200 text-gray-700 border border-gray-300 cursor-default'
    : 'text-white cursor-move border-2'

  return (
    <div
      className={`${baseStyles} ${typeStyles} ${conflictStyles} ${dragStyles}`}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        minHeight: '30px',
        pointerEvents: isDragging && !isBeingDragged ? 'none' : 'auto',
        ...(isPlanBlock && blockColor
          ? {
              backgroundColor: blockColor,
              borderColor: darkenColor(blockColor),
            }
          : {}),
      }}
      onMouseDown={handleMouseDown}
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
      {/* Top resize handle - only for plan blocks */}
      {isPlanBlock && (
        <div
          className="resize-handle absolute top-0 left-0 right-0 h-2 cursor-n-resize hover:opacity-50 transition-opacity"
          style={blockColor ? { backgroundColor: lightenColor(blockColor) } : undefined}
          onMouseDown={handleResizeTopMouseDown}
          aria-label="Resize top"
        />
      )}

      <div className="font-semibold truncate">{event.title}</div>
      <div className="text-xs opacity-90">
        {startTime} - {endTime}
      </div>
      {event.location && (
        <div className="text-xs opacity-75 truncate">{event.location}</div>
      )}

      {/* Bottom resize handle - only for plan blocks */}
      {isPlanBlock && (
        <div
          className="resize-handle absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:opacity-50 transition-opacity"
          style={blockColor ? { backgroundColor: lightenColor(blockColor) } : undefined}
          onMouseDown={handleResizeBottomMouseDown}
          aria-label="Resize bottom"
        />
      )}
    </div>
  )
}
