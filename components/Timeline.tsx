'use client'

import React, { useCallback, useState, useRef, useEffect } from 'react'
import { useTimeBoxStore } from '@/lib/store'
import { generateHourLabels, createISODateTime, parseISO, formatTime, minutesToTime } from '@/lib/time'
import TimeBlock from './TimeBlock'
import { PlanBlock } from '@/lib/types'
import { generateBlockId } from '@/lib/id'
import { calculateDraggedTime, calculateResizedTime, getDurationMinutes } from '@/lib/drag-utils'
import { CATEGORY_COLORS } from '@/lib/categories'

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
    isDragging,
    draggedBlockId,
    dragMode,
    dragOriginalStart,
    dragOriginalEnd,
    updatePlanBlock,
    endDrag,
    // Holding area drag
    holdingDragBlockId,
    unscheduledBlocks,
    removeUnscheduledBlock,
    endHoldingDrag,
  } = useTimeBoxStore()

  const timelineRef = useRef<HTMLDivElement>(null)
  const [dragStartY, setDragStartY] = useState<number | null>(null)
  const [tempBlockPosition, setTempBlockPosition] = useState<{ start: string; end: string } | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)

  // Ghost preview for holding-area drag
  const [ghostPreview, setGhostPreview] = useState<{ top: number; height: number; startTime: string; endTime: string } | null>(null)

  const hourLabels = generateHourLabels(startHour, endHour)
  const totalHours = endHour - startHour

  // Handle drag and resize with document-level mouse events
  useEffect(() => {
    if (!isDragging || !draggedBlockId || !dragOriginalStart || !dragOriginalEnd) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return

      const rect = timelineRef.current.getBoundingClientRect()
      const currentY = e.clientY - rect.top

      // Update tooltip position
      setTooltipPosition({ x: e.clientX, y: e.clientY })

      // Store initial position on first move
      if (dragStartY === null) {
        setDragStartY(currentY)
        return
      }

      let newTimes: { start: string; end: string }

      if (dragMode === 'move') {
        newTimes = calculateDraggedTime(
          dragStartY,
          currentY,
          dragOriginalStart,
          dragOriginalEnd,
          rect.height,
          startHour,
          endHour,
          selectedDate
        )
      } else if (dragMode === 'resize-top' || dragMode === 'resize-bottom') {
        newTimes = calculateResizedTime(
          dragMode,
          currentY,
          dragOriginalStart,
          dragOriginalEnd,
          rect.height,
          startHour,
          endHour,
          selectedDate
        )
      } else {
        return
      }

      setTempBlockPosition(newTimes)

      // Update the block in real-time
      updatePlanBlock(draggedBlockId, {
        start: newTimes.start,
        end: newTimes.end,
      })
    }

    const handleMouseUp = () => {
      // Finalize the drag
      endDrag()
      setDragStartY(null)
      setTempBlockPosition(null)
      setTooltipPosition(null)
    }

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    isDragging,
    draggedBlockId,
    dragMode,
    dragOriginalStart,
    dragOriginalEnd,
    dragStartY,
    startHour,
    endHour,
    selectedDate,
    updatePlanBlock,
    endDrag,
  ])

  // Handle holding-area drag over timeline
  useEffect(() => {
    if (!holdingDragBlockId) {
      setGhostPreview(null)
      return
    }

    const holdingBlock = unscheduledBlocks.find((b) => b.id === holdingDragBlockId)
    if (!holdingBlock) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return

      const rect = timelineRef.current.getBoundingClientRect()
      const isOverTimeline =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom

      if (!isOverTimeline) {
        setGhostPreview(null)
        return
      }

      const y = e.clientY - rect.top
      const clickedMinute = (y / rect.height) * (totalHours * 60) + startHour * 60
      const roundedMinute = Math.round(clickedMinute / 15) * 15

      // Constrain to timeline bounds
      const maxStart = endHour * 60 - holdingBlock.durationMinutes
      const clampedStart = Math.max(startHour * 60, Math.min(roundedMinute, maxStart))

      const endMinute = clampedStart + holdingBlock.durationMinutes
      const topPct = ((clampedStart - startHour * 60) / (totalHours * 60)) * 100
      const heightPct = (holdingBlock.durationMinutes / (totalHours * 60)) * 100

      setGhostPreview({
        top: topPct,
        height: heightPct,
        startTime: minutesToTime(clampedStart),
        endTime: minutesToTime(endMinute),
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!timelineRef.current || !holdingBlock) {
        endHoldingDrag()
        setGhostPreview(null)
        return
      }

      const rect = timelineRef.current.getBoundingClientRect()
      const isOverTimeline =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom

      if (isOverTimeline && ghostPreview) {
        // Convert to PlanBlock
        const startISO = createISODateTime(selectedDate, ghostPreview.startTime)
        const endISO = createISODateTime(selectedDate, ghostPreview.endTime)

        const newBlock: PlanBlock = {
          id: generateBlockId(),
          title: holdingBlock.title,
          start: startISO,
          end: endISO,
          color: holdingBlock.color,
          category: holdingBlock.category,
        }

        addPlanBlock(newBlock)
        removeUnscheduledBlock(holdingBlock.id)
      }

      endHoldingDrag()
      setGhostPreview(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    holdingDragBlockId,
    unscheduledBlocks,
    startHour,
    endHour,
    totalHours,
    selectedDate,
    addPlanBlock,
    removeUnscheduledBlock,
    endHoldingDrag,
    ghostPreview,
  ])

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't create new blocks when dragging
    if (isDragging || holdingDragBlockId) return

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
      id: generateBlockId(),
      title: 'Focus Block',
      start: startDateTime,
      end: endDateTime,
      location: '',
      notes: '',
      color: CATEGORY_COLORS.focus,
      category: 'focus',
    }

    addPlanBlock(newBlock)
    setSelectedBlockId(newBlock.id)
  }, [selectedDate, startHour, totalHours, addPlanBlock, setSelectedBlockId, isDragging, holdingDragBlockId])

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
      <div ref={timelineRef} className="flex-1 relative border-l-2 border-gray-300">
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
          style={{ cursor: isDragging || holdingDragBlockId ? 'default' : 'crosshair' }}
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

        {/* Ghost preview for holding-area drag */}
        {ghostPreview && holdingDragBlockId && (() => {
          const holdingBlock = unscheduledBlocks.find((b) => b.id === holdingDragBlockId)
          return (
            <div
              className="absolute left-0 right-0 mx-1 rounded-md px-2 py-1 text-sm text-white pointer-events-none border-2 border-dashed"
              style={{
                top: `${ghostPreview.top}%`,
                height: `${ghostPreview.height}%`,
                minHeight: '30px',
                backgroundColor: holdingBlock ? `${holdingBlock.color}80` : 'rgba(59,130,246,0.5)',
                borderColor: holdingBlock?.color || '#3b82f6',
              }}
            >
              <div className="font-semibold truncate">{holdingBlock?.title}</div>
              <div className="text-xs opacity-90">
                {ghostPreview.startTime} - {ghostPreview.endTime}
              </div>
            </div>
          )
        })()}

        {/* Drag/Resize Tooltip */}
        {isDragging && tooltipPosition && tempBlockPosition && (
          <div
            className="fixed z-50 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none"
            style={{
              left: `${tooltipPosition.x + 15}px`,
              top: `${tooltipPosition.y + 15}px`,
            }}
          >
            <div className="font-semibold">
              {formatTime(tempBlockPosition.start)} - {formatTime(tempBlockPosition.end)}
            </div>
            <div className="text-xs text-gray-300">
              {getDurationMinutes(tempBlockPosition.start, tempBlockPosition.end)} min
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
