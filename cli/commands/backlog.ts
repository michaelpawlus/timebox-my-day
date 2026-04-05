import { BacklogItem, TaskPriority, TaskStatus, TaskConstraints, BlockCategory } from '../../lib/types'
import { generateBlockId } from '../../lib/id'
import {
  getBacklog,
  addBacklogItem,
  updateBacklogItem,
  removeBacklogItem,
  completeBacklogItem,
} from '../backlog-store'

const PRIORITY_MAP: Record<string, TaskPriority> = {
  hard: 'hard-deadline',
  soft: 'soft-deadline',
  none: 'no-deadline',
}

function parsePriority(input: string): TaskPriority {
  return PRIORITY_MAP[input] || (input as TaskPriority)
}

export function addItem(opts: {
  title: string
  duration: number
  priority: string
  deadline?: string
  outdoor?: boolean
  daylight?: boolean
  weekend?: boolean
  category?: string
  preferredStart?: string
  preferredEnd?: string
}): BacklogItem {
  const constraints: TaskConstraints = {}
  if (opts.outdoor) constraints.outdoor = true
  if (opts.daylight) constraints.daylight = true
  if (opts.weekend) constraints.weekendOnly = true
  if (opts.preferredStart && opts.preferredEnd) {
    constraints.preferredWindow = { start: opts.preferredStart, end: opts.preferredEnd }
  }

  const item: BacklogItem = {
    id: generateBlockId(),
    title: opts.title,
    durationMinutes: opts.duration,
    priority: parsePriority(opts.priority),
    deadline: opts.deadline,
    constraints,
    category: opts.category as BlockCategory | undefined,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  addBacklogItem(item)
  return item
}

export function listItems(opts?: {
  priority?: string
  status?: string
}): BacklogItem[] {
  const { items } = getBacklog()

  return items.filter(item => {
    if (opts?.priority) {
      const p = parsePriority(opts.priority)
      if (item.priority !== p) return false
    }
    if (opts?.status) {
      if (opts.status === 'all') return true
      if (item.status !== opts.status) return false
    } else {
      // Default: exclude completed
      if (item.status === 'completed') return false
    }
    return true
  })
}

export function updateItem(
  id: string,
  updates: {
    title?: string
    duration?: number
    priority?: string
    deadline?: string
    status?: string
    outdoor?: boolean
    daylight?: boolean
    weekend?: boolean
  },
): { item: BacklogItem | null; found: boolean } {
  const mapped: Partial<BacklogItem> = {}
  if (updates.title) mapped.title = updates.title
  if (updates.duration) mapped.durationMinutes = updates.duration
  if (updates.priority) mapped.priority = parsePriority(updates.priority)
  if (updates.deadline) mapped.deadline = updates.deadline
  if (updates.status) mapped.status = updates.status as TaskStatus

  const { backlog, found } = updateBacklogItem(id, mapped)
  const item = found ? backlog.items.find(i => i.id === id) || null : null
  return { item, found }
}

export function removeItem(id: string): { found: boolean } {
  const { found } = removeBacklogItem(id)
  return { found }
}

export function completeItem(id: string): { item: BacklogItem | null; found: boolean } {
  const { backlog, found } = completeBacklogItem(id)
  const item = found ? backlog.items.find(i => i.id === id) || null : null
  return { item, found }
}

function formatConstraints(c: TaskConstraints): string {
  const parts: string[] = []
  if (c.outdoor) parts.push('outdoor')
  if (c.daylight) parts.push('daylight')
  if (c.weekendOnly) parts.push('weekend-only')
  if (c.preferredWindow) parts.push(`${c.preferredWindow.start}-${c.preferredWindow.end}`)
  return parts.length > 0 ? parts.join(', ') : ''
}

export function formatBacklogHuman(items: BacklogItem[]): string {
  if (items.length === 0) {
    return 'Backlog is empty'
  }

  const lines: string[] = [`Backlog (${items.length} item${items.length === 1 ? '' : 's'})`, '']

  for (const item of items) {
    const deadlineStr = item.deadline ? ` by ${item.deadline}` : ''
    const statusStr = item.status.toUpperCase()
    const idShort = item.id.substring(0, 8)
    lines.push(`  [${idShort}] ${item.title} (${item.durationMinutes} min) - ${item.priority}${deadlineStr} - ${statusStr}`)

    const constraintStr = formatConstraints(item.constraints)
    if (constraintStr) {
      lines.push(`           Constraints: ${constraintStr}`)
    }
  }

  return lines.join('\n')
}
