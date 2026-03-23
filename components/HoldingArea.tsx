'use client'

import React from 'react'
import { useTimeBoxStore } from '@/lib/store'
import { darkenColor } from '@/lib/categories'

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  return `${minutes}m`
}

export default function HoldingArea() {
  const { unscheduledBlocks, removeUnscheduledBlock, startHoldingDrag, endHoldingDrag } = useTimeBoxStore()

  const handleMouseDown = (id: string) => {
    startHoldingDrag(id)

    const handleMouseUp = () => {
      setTimeout(() => {
        endHoldingDrag()
      }, 0)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mouseup', handleMouseUp)
  }

  if (unscheduledBlocks.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-card-foreground mb-2">Holding Area</h3>
        <p className="text-sm text-muted-foreground">
          Blocks without a set time will appear here. Drag them onto the timeline to schedule.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg shadow-md p-4">
      <h3 className="font-semibold text-card-foreground mb-3">Holding Area</h3>
      <div className="space-y-2">
        {unscheduledBlocks.map((block) => (
          <div
            key={block.id}
            className="rounded-md px-3 py-2 text-white text-sm cursor-grab active:cursor-grabbing select-none flex items-center justify-between"
            style={{
              backgroundColor: block.color,
              borderLeft: `4px solid ${darkenColor(block.color)}`,
            }}
            onMouseDown={() => handleMouseDown(block.id)}
          >
            <div>
              <div className="font-semibold truncate">{block.title}</div>
              <div className="text-xs opacity-90">{formatDuration(block.durationMinutes)}</div>
            </div>
            <button
              className="ml-2 text-white opacity-70 hover:opacity-100 text-lg leading-none"
              onClick={(e) => {
                e.stopPropagation()
                removeUnscheduledBlock(block.id)
              }}
              aria-label={`Remove ${block.title}`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
