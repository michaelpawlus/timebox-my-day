'use client'

import React, { useCallback, useState } from 'react'
import { useTimeBoxStore } from '@/lib/store'
import { generateHourLabels, createISODateTime, parseISO } from '@/lib/time'
import TimeBlock from './TimeBlock'
import { PlanBlock } from '@/lib/types'

function uuid() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export default function Timeline() {
  const {
    selectedDate,
    startHour,
    endHour,
    busyEvents,
    planBlocks,
    conflicts,
    setSelectedBlockId,
    addPlanBlock,
  } = useTimeBoxStore()

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<number | null>(null)

  const hourLabels = generateHourLabels(startHour, endHour)
  const totalHours = endHour - startHour

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const clickedMinute = (y / rect.height) * (totalHours * 60) + (startHour * 60)
    
    // Round to nearest 15 minutes
    const roundedMinute = Math.round(clickedMinute / 15) * 15
    const hours = Math.floor(roundedMinute / 60)
    const minutes = roundedMinute % 60
    
    const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    const startDateTime = createISODateTime(selectedDate, startTime)
    
    // Default 60-minute duration
    const endDate = new Date(parseISO(startDateTime))
    endDate.setMinutes(endDate.getMinutes() + 60)
    const endDateTime = endDate.toISOString()

    const newBlock: PlanBlock = {
      id: uuid(),
      title: 'Focus Block',
      start: startDateTime,
      end: endDateTime,
      location: '',
      notes: '',
    }

    addPlanBlock(newBlock)
    setSelectedBlockId(newBlock.id)
  }, [selectedDate, startHour, totalHours, addPlanBlock, setSelectedBlockId])

  const handleBlockClick = useCallback((id: string) => {
    setSelectedBlockId(id)
  }, [setSelectedBlockId])

  return (
    <div className="flex gap-4 h-full">
      {/* Hour labels */}
      <div className="flex flex-col justify-between py-2 text-sm text-gray-500 w-16">
        {hourLabels.map((label, index) => (
          <div key={index} className="text-right pr-2">
            {label}
          </div>
        ))}
      </div>

      {/* Timeline grid */}
      <div className="flex-1 relative border-l-2 border-gray-300">
        {/* Hour lines */}
        {hourLabels.map((_, index) => (
          <div
            key={index}
            className="absolute left-0 right-0 border-t border-gray-200"
            style={{ top: `${(index / totalHours) * 100}%` }}
          />
        ))}

        {/* Click area for creating blocks */}
        <div
          className="absolute inset-0 cursor-crosshair hover:bg-blue-50 hover:bg-opacity-30 transition-colors"
          onClick={handleTimelineClick}
          role="button"
          aria-label="Click to create a new plan block"
          tabIndex={0}
        />

        {/* Busy events */}
        {busyEvents.map((event) => (
          <TimeBlock
            key={event.id}
            event={event}
            type="busy"
            startHour={startHour}
            endHour={endHour}
          />
        ))}

        {/* Plan blocks */}
        {planBlocks.map((block) => {
          const hasConflict = conflicts.some(c => c.planBlockId === block.id)
          return (
            <TimeBlock
              key={block.id}
              event={block}
              type="plan"
              startHour={startHour}
              endHour={endHour}
              onClick={() => handleBlockClick(block.id)}
              hasConflict={hasConflict}
            />
          )
        })}
      </div>
    </div>
  )
}

