import { captureItem } from './capture'
import { BacklogView } from '../types'
import {
  ApplyUpdates,
  InboxItem,
  InboxStatus,
  buildItemBlock,
  computeItemId,
  findItemById,
  itemStatus,
  readInbox,
  writeInboxRemove,
  writeInboxReplace,
} from '../inbox-store'

// The backlog now reads and writes the Obsidian inbox markdown
// ($OBSIDIAN_VAULT_PATH/backlog/inbox.md) — the single source of truth shared
// with `capture`, `refine`, and the plan-day synthesizer. Items use the same
// content-hash IDs as those commands (sha1 of title + captured date).

export type { BacklogView }

type Priority = 'hard' | 'soft' | 'none'

function parsePriority(input?: string): Priority {
  if (input === 'hard' || input === 'soft' || input === 'none') return input
  // Tolerate legacy long-form values from the old JSON store.
  if (input === 'hard-deadline') return 'hard'
  if (input === 'soft-deadline') return 'soft'
  if (input === 'no-deadline') return 'none'
  return 'none'
}

function toView(item: InboxItem): BacklogView {
  const duration = item.fields.duration ? parseInt(item.fields.duration, 10) : undefined
  return {
    id: item.id,
    title: item.title,
    durationMinutes: Number.isFinite(duration as number) ? duration : undefined,
    priority: parsePriority(item.fields.priority),
    deadline: item.fields.deadline,
    status: itemStatus(item),
    tags: item.tags,
    done: item.done,
  }
}

export function addItem(opts: {
  title: string
  duration?: number
  priority?: string
  deadline?: string
  outdoor?: boolean
  daylight?: boolean
  weekend?: boolean
  tags?: string[]
}): BacklogView {
  const tags = [...(opts.tags || [])]
  if (opts.outdoor) tags.push('outdoor')
  if (opts.daylight) tags.push('daylight')
  if (opts.weekend) tags.push('weekend')

  const result = captureItem({
    title: opts.title,
    tags,
    duration: opts.duration,
    priority: opts.priority ? parsePriority(opts.priority) : undefined,
    deadline: opts.deadline,
  })

  const id = computeItemId(opts.title, result.capturedAt)
  const { items } = readInbox()
  const item = findItemById(items, id)
  return item ? toView(item) : {
    id,
    title: opts.title,
    durationMinutes: opts.duration,
    priority: parsePriority(opts.priority),
    deadline: opts.deadline,
    status: 'pending',
    tags,
    done: false,
  }
}

export function listItems(opts?: {
  priority?: string
  status?: string
}): BacklogView[] {
  const { items } = readInbox()

  return items
    .map(toView)
    .filter(view => {
      if (opts?.priority && view.priority !== parsePriority(opts.priority)) return false
      if (opts?.status) {
        if (opts.status === 'all') return true
        if (view.status !== opts.status) return false
      } else if (view.status === 'completed') {
        // Default: exclude completed
        return false
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
  },
): { item: BacklogView | null; found: boolean } {
  const { items } = readInbox()
  const item = findItemById(items, id)
  if (!item) {
    return { item: null, found: false }
  }

  const apply: ApplyUpdates = {}
  if (updates.title !== undefined) apply.title = updates.title
  if (updates.duration !== undefined) apply.duration = updates.duration
  if (updates.priority !== undefined) apply.priority = parsePriority(updates.priority)
  if (updates.deadline !== undefined) apply.deadline = updates.deadline
  if (updates.status !== undefined) apply.status = updates.status as InboxStatus

  const newLines = buildItemBlock(item, apply)
  writeInboxReplace(item.id, newLines)

  // Title changes shift the content-hash id; resolve the item by its new id.
  const newId = computeItemId(apply.title ?? item.title, item.fields.captured || '')
  const refreshed = readInbox()
  const after = findItemById(refreshed.items, newId)
  return { item: after ? toView(after) : null, found: true }
}

export function removeItem(id: string): { found: boolean } {
  const { items } = readInbox()
  if (!findItemById(items, id)) {
    return { found: false }
  }
  writeInboxRemove(id)
  return { found: true }
}

export function completeItem(id: string): { item: BacklogView | null; found: boolean } {
  const { items } = readInbox()
  const item = findItemById(items, id)
  if (!item) {
    return { item: null, found: false }
  }
  const newLines = buildItemBlock(item, { status: 'completed' })
  writeInboxReplace(item.id, newLines)
  const refreshed = readInbox()
  const after = findItemById(refreshed.items, item.id)
  return { item: after ? toView(after) : null, found: true }
}

export function formatBacklogHuman(items: BacklogView[]): string {
  if (items.length === 0) {
    return 'Backlog is empty'
  }

  const lines: string[] = [`Backlog (${items.length} item${items.length === 1 ? '' : 's'})`, '']

  for (const item of items) {
    const deadlineStr = item.deadline ? ` by ${item.deadline}` : ''
    const durationStr = item.durationMinutes !== undefined ? `${item.durationMinutes} min` : 'no duration'
    const statusStr = item.status.toUpperCase()
    const idShort = item.id.substring(0, 8)
    lines.push(`  [${idShort}] ${item.title} (${durationStr}) - ${item.priority}${deadlineStr} - ${statusStr}`)

    const domainTags = item.tags.filter(t => t.startsWith('task/'))
    const constraintTags = item.tags.filter(t => ['outdoor', 'daylight', 'weekend', 'offline'].includes(t))
    const tagBits = [...domainTags, ...constraintTags]
    if (tagBits.length > 0) {
      lines.push(`           Tags: ${tagBits.join(', ')}`)
    }
  }

  return lines.join('\n')
}
