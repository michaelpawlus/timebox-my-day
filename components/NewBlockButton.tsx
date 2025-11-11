'use client'

import React from 'react'
import Button from './ui/Button'
import { useTimeBoxStore } from '@/lib/store'
import { PlanBlock } from '@/lib/types'
import { createISODateTime } from '@/lib/time'
import { generateBlockId } from '@/lib/id'

export default function NewBlockButton() {
  const { selectedDate, startHour, addPlanBlock, setSelectedBlockId } = useTimeBoxStore()

  const handleNewBlock = () => {
    // Create a block starting at the next hour
    const now = new Date()
    const nextHour = now.getHours() + 1
    const startTime = `${nextHour.toString().padStart(2, '0')}:00`
    
    const startDateTime = createISODateTime(selectedDate, startTime)
    const endDate = new Date(startDateTime)
    endDate.setHours(endDate.getHours() + 1)
    const endDateTime = endDate.toISOString()

    const newBlock: PlanBlock = {
      id: generateBlockId(),
      title: 'Focus Block',
      start: startDateTime,
      end: endDateTime,
      location: '',
      notes: '',
    }

    addPlanBlock(newBlock)
    setSelectedBlockId(newBlock.id)
  }

  return (
    <Button
      variant="primary"
      size="md"
      onClick={handleNewBlock}
      className="w-full"
    >
      + New Block
    </Button>
  )
}

