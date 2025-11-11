import { BusyEvent, PlanBlock, Conflict } from './types'
import { parseISO } from 'date-fns'

export function checkOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = parseISO(start1).getTime()
  const e1 = parseISO(end1).getTime()
  const s2 = parseISO(start2).getTime()
  const e2 = parseISO(end2).getTime()

  // Check if intervals overlap
  return s1 < e2 && s2 < e1
}

export function detectConflicts(
  planBlocks: PlanBlock[],
  busyEvents: BusyEvent[]
): Conflict[] {
  const conflicts: Conflict[] = []

  for (const planBlock of planBlocks) {
    // Check conflicts with busy events
    for (const busyEvent of busyEvents) {
      if (checkOverlap(planBlock.start, planBlock.end, busyEvent.start, busyEvent.end)) {
        conflicts.push({
          planBlockId: planBlock.id,
          conflictsWith: busyEvent.id,
          type: 'busy',
        })
      }
    }

    // Check conflicts with other plan blocks
    for (const otherBlock of planBlocks) {
      if (
        planBlock.id !== otherBlock.id &&
        checkOverlap(planBlock.start, planBlock.end, otherBlock.start, otherBlock.end)
      ) {
        conflicts.push({
          planBlockId: planBlock.id,
          conflictsWith: otherBlock.id,
          type: 'plan',
        })
      }
    }
  }

  return conflicts
}

export function getConflictsForBlock(blockId: string, conflicts: Conflict[]): Conflict[] {
  return conflicts.filter(c => c.planBlockId === blockId)
}

export function hasConflict(blockId: string, conflicts: Conflict[]): boolean {
  return conflicts.some(c => c.planBlockId === blockId)
}

