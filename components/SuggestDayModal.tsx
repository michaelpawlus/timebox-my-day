'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTimeBoxStore } from '@/lib/store'
import { getColorForTitle } from '@/lib/categories'
import { generateBlockId } from '@/lib/id'
import { showSuccess } from '@/lib/toast'
import type { ArchetypePlan, PlanBlockDraft, PlanDayResult } from '@/lib/synthesizer'
import { PlanBlock } from '@/lib/types'

interface SuggestDayModalProps {
  isOpen: boolean
  onClose: () => void
}

const SOURCE_LABEL: Record<PlanBlockDraft['source'], string> = {
  busy: 'busy',
  lunch: 'lunch',
  inbox: 'inbox',
  catalog: 'code',
  workout: 'workout',
  'existing-plan': 'existing',
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function SuggestDayModal({ isOpen, onClose }: SuggestDayModalProps) {
  const { selectedDate, planBlocks, clearPlanBlocks, addPlanBlock } = useTimeBoxStore()

  const [result, setResult] = useState<PlanDayResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  // Tracks the in-flight request so a stale response (e.g. the modal was closed
  // and reopened on a different date) can't overwrite newer state.
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)
    setResult(null)
    // Read the live canvas state at click time, not whatever was captured when
    // this callback was last memoized — the user may have imported a calendar or
    // edited blocks since the modal mounted.
    const { busyEvents, planBlocks } = useTimeBoxStore.getState()
    try {
      const res = await fetch('/api/plan-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          busyEvents,
          existingPlanBlocks: planBlocks,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      const data = (await res.json()) as PlanDayResult
      if (controller.signal.aborted) return
      setResult(data)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      // Leave isLoading alone if this request was superseded — a newer generate()
      // owns the loading state now.
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [dateStr])

  // Synthesize when the modal opens (and re-synthesize if the date changes while
  // open). On close, abort any in-flight request and reset transient state so the
  // next open starts fresh and a late response can't land on a new context.
  useEffect(() => {
    if (isOpen) {
      generate()
    } else {
      abortRef.current?.abort()
      abortRef.current = null
      setResult(null)
      setError(null)
      setIsLoading(false)
    }
  }, [isOpen, generate])

  const applyPlan = (plan: ArchetypePlan) => {
    // Load everything except busy events — busy events already render from the
    // store's busyEvents and aren't editable plan blocks.
    const drafts = plan.blocks.filter(b => b.source !== 'busy')
    if (
      planBlocks.length > 0 &&
      !window.confirm('Replace the current plan blocks with this suggestion?')
    ) {
      return
    }
    const newBlocks: PlanBlock[] = drafts.map(draft => {
      const { color, category } = getColorForTitle(draft.title)
      return {
        id: generateBlockId(),
        title: draft.title,
        start: `${dateStr}T${draft.start}:00`,
        end: `${dateStr}T${draft.end}:00`,
        color,
        category: draft.category || category,
        notes: draft.notes,
      }
    })
    clearPlanBlocks()
    newBlocks.forEach(addPlanBlock)
    showSuccess(`Loaded "${plan.archetype}" — ${newBlocks.length} block${newBlocks.length === 1 ? '' : 's'} into the editor`)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Suggest a Day — {format(selectedDate, 'EEE, MMM d')}</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-12 text-center text-muted-foreground">
            Synthesizing plans from your backlog, calendar, weather, and workout…
          </div>
        )}

        {error && (
          <div className="mt-2 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 font-medium">Couldn&apos;t generate suggestions</p>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
            <div className="mt-3">
              <Button size="sm" onClick={generate}>Try again</Button>
            </div>
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-4">
            {/* Context summary */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {result.weather ? (
                <span>
                  Weather: {result.weather.summary} · outdoor {result.weather.outdoor_score}/100 (best {result.weather.best_outdoor_window})
                </span>
              ) : (
                <span>Weather: unavailable</span>
              )}
              {result.workout && (
                <span>
                  Workout: {result.workout.title}
                  {result.workout.rest_day ? ' (rest day)' : ` (${result.workout.duration_minutes}m)`}
                </span>
              )}
              <span>{result.inboxCandidates} inbox · {result.catalogCandidates} catalog candidates</span>
            </div>

            {/* Plan cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {result.plans.map(plan => (
                <div
                  key={plan.id}
                  className="flex flex-col border border-border rounded-lg p-4 bg-card"
                >
                  <h3 className="font-semibold text-foreground">{plan.archetype}</h3>
                  <p className="text-sm text-muted-foreground mt-1 min-h-[2.5rem]">{plan.rationale}</p>

                  <ul className="mt-3 space-y-1 text-xs max-h-64 overflow-y-auto">
                    {plan.blocks.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono text-muted-foreground shrink-0">{b.start}–{b.end}</span>
                        <span className="text-muted-foreground/70 shrink-0 w-14">[{SOURCE_LABEL[b.source]}]</span>
                        <span className="text-foreground truncate" title={b.title}>{b.title}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatMinutes(plan.scheduledMinutes)} scheduled · {formatMinutes(plan.freeMinutes)} free
                    {plan.unplacedTaskCount > 0 && ` · ${plan.unplacedTaskCount} didn't fit`}
                  </p>

                  <div className="mt-3 pt-3 border-t border-border">
                    <Button className="w-full" size="sm" onClick={() => applyPlan(plan)}>
                      Use this plan
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={generate}>Regenerate</Button>
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
