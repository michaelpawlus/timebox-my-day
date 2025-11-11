'use client'

import React from 'react'
import { useTimeBoxStore } from '@/lib/store'

export default function TimeWindowControls() {
  const { startHour, endHour, setTimeWindow } = useTimeBoxStore()

  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="flex items-center gap-4">
      <label className="text-sm text-gray-600">
        View from:
        <select
          value={startHour}
          onChange={(e) => setTimeWindow(Number(e.target.value), endHour)}
          className="ml-2 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {hours.slice(0, endHour - 1).map((hour) => (
            <option key={hour} value={hour}>
              {hour.toString().padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm text-gray-600">
        to:
        <select
          value={endHour}
          onChange={(e) => setTimeWindow(startHour, Number(e.target.value))}
          className="ml-2 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {hours.slice(startHour + 1).map((hour) => (
            <option key={hour} value={hour}>
              {hour.toString().padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

