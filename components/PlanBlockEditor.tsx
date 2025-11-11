'use client'

import React, { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { useTimeBoxStore } from '@/lib/store'
import { PlanBlock } from '@/lib/types'
import { formatDate, formatTime, parseISO } from '@/lib/time'

interface PlanBlockEditorProps {
  blockId: string | null
  onClose: () => void
}

export default function PlanBlockEditor({ blockId, onClose }: PlanBlockEditorProps) {
  const { planBlocks, updatePlanBlock, deletePlanBlock, selectedDate } = useTimeBoxStore()
  
  const block = planBlocks.find(b => b.id === blockId)
  
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    startTime: '',
    duration: 60,
    location: '',
    notes: '',
  })

  useEffect(() => {
    if (block) {
      const startDate = parseISO(block.start)
      const endDate = parseISO(block.end)
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60)
      
      setFormData({
        title: block.title,
        startDate: formatDate(startDate),
        startTime: formatTime(startDate),
        duration: durationMinutes,
        location: block.location || '',
        notes: block.notes || '',
      })
    }
  }, [block])

  if (!block) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const [hours, minutes] = formData.startTime.split(':').map(Number)
    const startDateTime = new Date(formData.startDate)
    startDateTime.setHours(hours, minutes, 0, 0)
    
    const endDateTime = new Date(startDateTime)
    endDateTime.setMinutes(endDateTime.getMinutes() + formData.duration)
    
    updatePlanBlock(block.id, {
      title: formData.title,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      location: formData.location || undefined,
      notes: formData.notes || undefined,
    })
    
    onClose()
  }

  const handleDelete = () => {
    if (confirm('Delete this plan block?')) {
      deletePlanBlock(block.id)
      onClose()
    }
  }

  return (
    <Modal isOpen={blockId !== null} onClose={onClose} title="Edit Plan Block" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              id="startDate"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time *
            </label>
            <input
              type="time"
              id="startTime"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
            Duration (minutes) *
          </label>
          <select
            id="duration"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={240}>4 hours</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Office, Home, etc."
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Additional details..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button type="button" variant="danger" onClick={handleDelete}>
            Delete
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

