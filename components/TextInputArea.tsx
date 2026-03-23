'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTimeBoxStore } from '@/lib/store'
import { parseTextInput } from '@/lib/text-parse'
import { createISODateTime, minutesToTime } from '@/lib/time'
import { generateBlockId } from '@/lib/id'
import { showSuccess } from '@/lib/toast'
import { PlanBlock, UnscheduledBlock } from '@/lib/types'

export default function TextInputArea() {
  const [text, setText] = useState('')
  const {
    selectedDate,
    addPlanBlock,
    addUnscheduledBlock,
    clearPlanBlocks,
    clearUnscheduledBlocks,
  } = useTimeBoxStore()

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return

    const parsed = parseTextInput(trimmed)
    if (parsed.length === 0) return

    clearPlanBlocks()
    clearUnscheduledBlocks()

    let scheduledCount = 0
    let unscheduledCount = 0

    for (const block of parsed) {
      if (block.startMinutes !== undefined && block.endMinutes !== undefined) {
        const startTime = minutesToTime(block.startMinutes)
        const endTime = minutesToTime(block.endMinutes)
        const startISO = createISODateTime(selectedDate, startTime)
        const endISO = createISODateTime(selectedDate, endTime)

        const planBlock: PlanBlock = {
          id: generateBlockId(),
          title: block.title,
          start: startISO,
          end: endISO,
          color: block.color,
          category: block.category,
        }
        addPlanBlock(planBlock)
        scheduledCount++
      } else {
        const unscheduled: UnscheduledBlock = {
          id: generateBlockId(),
          title: block.title,
          durationMinutes: block.durationMinutes,
          color: block.color,
          category: block.category,
        }
        addUnscheduledBlock(unscheduled)
        unscheduledCount++
      }
    }

    const parts: string[] = []
    if (scheduledCount > 0) parts.push(`${scheduledCount} scheduled`)
    if (unscheduledCount > 0) parts.push(`${unscheduledCount} in holding area`)
    showSuccess(`Created ${parts.join(' and ')} blocks`)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  return (
    <div className="bg-card rounded-lg shadow-md p-4">
      <label htmlFor="plan-input" className="block text-sm font-medium text-foreground mb-2">
        Describe your day
      </label>
      <textarea
        id="plan-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        placeholder="Focus Time - 2 hours; Run - 1 hour; Lunch - 30 min; Meeting - 2pm - 4pm; Dinner - 30 min"
      />
      <div className="flex items-center gap-2 mt-2">
        <Button size="sm" onClick={handleSubmit} disabled={!text.trim()}>
          Plan My Day
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setText('')} disabled={!text}>
          Clear
        </Button>
        <span className="text-xs text-muted-foreground ml-2">
          Ctrl+Enter to submit
        </span>
      </div>
    </div>
  )
}
