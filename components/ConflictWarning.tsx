'use client'

import React from 'react'
import { useTimeBoxStore } from '@/lib/store'
import { getConflictsForBlock } from '@/lib/validation'
import { BusyEvent, PlanBlock } from '@/lib/types'

export default function ConflictWarning() {
  const { planBlocks, busyEvents, conflicts } = useTimeBoxStore()

  const totalConflicts = conflicts.length
  const uniqueBlocksWithConflicts = new Set(conflicts.map(c => c.planBlockId)).size

  if (totalConflicts === 0) return null

  const getEventTitle = (id: string, type: 'busy' | 'plan'): string => {
    if (type === 'busy') {
      const event = busyEvents.find(e => e.id === id)
      return event?.title || 'Unknown Event'
    } else {
      const block = planBlocks.find(b => b.id === id)
      return block?.title || 'Unknown Block'
    }
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Scheduling Conflicts Detected
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              {uniqueBlocksWithConflicts} plan block{uniqueBlocksWithConflicts !== 1 ? 's' : ''}{' '}
              {uniqueBlocksWithConflicts !== 1 ? 'have' : 'has'} conflicts ({totalConflicts} total overlap{totalConflicts !== 1 ? 's' : ''}).
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer font-medium hover:text-yellow-900">
                View details
              </summary>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {Array.from(new Set(conflicts.map(c => c.planBlockId))).map(blockId => {
                  const blockConflicts = getConflictsForBlock(blockId, conflicts)
                  const blockTitle = getEventTitle(blockId, 'plan')
                  return (
                    <li key={blockId}>
                      <strong>{blockTitle}</strong> overlaps with:{' '}
                      {blockConflicts.map((c, idx) => (
                        <span key={`${c.conflictsWith}-${idx}`}>
                          {idx > 0 && ', '}
                          {getEventTitle(c.conflictsWith, c.type)}
                        </span>
                      ))}
                    </li>
                  )
                })}
              </ul>
            </details>
          </div>
        </div>
      </div>
    </div>
  )
}

