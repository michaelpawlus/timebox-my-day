'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTimeBoxStore } from '@/lib/store'
import { BlockCategory } from '@/lib/types'
import { formatDate, formatTime, parseISO } from '@/lib/time'
import { CATEGORY_COLORS, EXTRA_COLORS } from '@/lib/categories'

interface PlanBlockEditorProps {
  blockId: string | null
  onClose: () => void
}

const CATEGORY_LABELS: Record<BlockCategory, string> = {
  meal: 'Meal',
  exercise: 'Exercise',
  meeting: 'Meeting',
  focus: 'Focus',
  break: 'Break',
  other: 'Other',
}

export default function PlanBlockEditor({ blockId, onClose }: PlanBlockEditorProps) {
  const { planBlocks, updatePlanBlock, deletePlanBlock } = useTimeBoxStore()

  const block = planBlocks.find(b => b.id === blockId)

  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    startTime: '',
    duration: 60,
    location: '',
    notes: '',
    category: 'focus' as BlockCategory,
    color: CATEGORY_COLORS.focus,
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
        category: block.category || 'focus',
        color: block.color || CATEGORY_COLORS.focus,
      })
    }
  }, [block])

  if (!block) return null

  const handleCategoryChange = (category: BlockCategory) => {
    setFormData({
      ...formData,
      category,
      color: CATEGORY_COLORS[category],
    })
  }

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
      color: formData.color,
      category: formData.category,
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
    <Dialog open={blockId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Plan Block</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Category
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(CATEGORY_LABELS) as BlockCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    formData.category === cat
                      ? 'text-white ring-2 ring-offset-1 ring-ring'
                      : 'text-white opacity-60 hover:opacity-80'
                  }`}
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  onClick={() => handleCategoryChange(cat)}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Color */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Custom Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {EXTRA_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    formData.color === color
                      ? 'border-foreground ring-2 ring-offset-1 ring-ring'
                      : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                  aria-label={`Color ${color}`}
                />
              ))}
              <label
                className="relative w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground cursor-pointer overflow-hidden"
                title="Pick any color"
              >
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div
                  className="w-full h-full rounded-full"
                  style={{ backgroundColor: formData.color }}
                />
              </label>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-foreground mb-1">
                Date *
              </label>
              <input
                type="date"
                id="startDate"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-foreground mb-1">
                Start Time *
              </label>
              <input
                type="time"
                id="startTime"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-foreground mb-1">
              Duration (minutes) *
            </label>
            <select
              id="duration"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
            <label htmlFor="location" className="block text-sm font-medium text-foreground mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Office, Home, etc."
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Additional details..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
