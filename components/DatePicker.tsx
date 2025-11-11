'use client'

import React from 'react'
import { format, addDays, subDays } from 'date-fns'
import { useTimeBoxStore } from '@/lib/store'
import Button from './ui/Button'

export default function DatePicker() {
  const { selectedDate, setSelectedDate } = useTimeBoxStore()

  const today = new Date()
  const minDate = subDays(today, 3)
  const maxDate = addDays(today, 3)

  const handlePrevDay = () => {
    const newDate = subDays(selectedDate, 1)
    if (newDate >= minDate) {
      setSelectedDate(newDate)
    }
  }

  const handleNextDay = () => {
    const newDate = addDays(selectedDate, 1)
    if (newDate <= maxDate) {
      setSelectedDate(newDate)
    }
  }

  const handleToday = () => {
    setSelectedDate(today)
  }

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
  const canGoPrev = selectedDate > minDate
  const canGoNext = selectedDate < maxDate

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePrevDay}
        disabled={!canGoPrev}
        aria-label="Previous day"
      >
        ←
      </Button>
      
      <div className="flex items-center gap-2">
        <span className="font-semibold text-lg">
          {format(selectedDate, 'EEEE, MMM d, yyyy')}
        </span>
        {!isToday && (
          <Button variant="secondary" size="sm" onClick={handleToday}>
            Today
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleNextDay}
        disabled={!canGoNext}
        aria-label="Next day"
      >
        →
      </Button>
    </div>
  )
}

