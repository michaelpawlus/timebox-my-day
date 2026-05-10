import {
  ApplyUpdates,
  InboxItem,
  MissingField,
  buildItemBlock,
  classifyMissing,
  findItemById,
  readInbox,
  writeInboxRemove,
  writeInboxReplace,
} from '../inbox-store'

export interface RefineBriefingItem {
  id: string
  title: string
  captured: string
  tags: string[]
  existingFields: Record<string, string>
  missing: MissingField[]
  suggestedQuestions: string[]
}

export interface RefineBriefing {
  inboxPath: string
  totalItems: number
  refinedCount: number
  unrefinedCount: number
  items: RefineBriefingItem[]
}

const DOMAIN_TAGS = ['task/house', 'task/personal', 'task/learning', 'task/errand', 'task/admin']
const PRIORITY_VALUES = ['hard', 'soft', 'none']

function suggestQuestions(item: InboxItem, missing: MissingField[]): string[] {
  const out: string[] = []
  if (missing.includes('duration')) {
    out.push(`How long will "${item.title}" take, in minutes?`)
  }
  if (missing.includes('priority')) {
    out.push(`Priority for "${item.title}"? (${PRIORITY_VALUES.join(' / ')})`)
  }
  if (missing.includes('domainTag')) {
    out.push(`Which domain for "${item.title}"? (${DOMAIN_TAGS.join(' / ')})`)
  }
  return out
}

function toBriefingItem(item: InboxItem): RefineBriefingItem {
  const { missing } = classifyMissing(item)
  return {
    id: item.id,
    title: item.title,
    captured: item.fields.captured || '',
    tags: item.tags,
    existingFields: { ...item.fields },
    missing,
    suggestedQuestions: suggestQuestions(item, missing),
  }
}

export function refineList(opts: { limit?: number } = {}): RefineBriefing {
  const { path, items } = readInbox()
  const active = items.filter(i => !i.done)
  const classified = active.map(i => ({ item: i, info: classifyMissing(i) }))
  const refinedCount = classified.filter(c => c.info.refined).length
  const unrefined = classified.filter(c => !c.info.refined).map(c => c.item)
  const limited = opts.limit !== undefined ? unrefined.slice(0, Math.max(0, opts.limit)) : unrefined
  return {
    inboxPath: path,
    totalItems: active.length,
    refinedCount,
    unrefinedCount: unrefined.length,
    items: limited.map(toBriefingItem),
  }
}

export interface RefineApplyResult {
  found: boolean
  id: string
  title?: string
  fieldsApplied?: ApplyUpdates
  refined?: boolean
  changed?: boolean
  before?: string[]
  after?: string[]
  dryRun?: boolean
}

function validatePriority(p: string | undefined): 'hard' | 'soft' | 'none' | undefined {
  if (p === undefined) return undefined
  if (!PRIORITY_VALUES.includes(p)) {
    throw new Error(`Invalid priority "${p}" — must be one of ${PRIORITY_VALUES.join(', ')}`)
  }
  return p as 'hard' | 'soft' | 'none'
}

function validateDeadline(d: string | undefined): string | undefined {
  if (d === undefined) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error(`Invalid deadline "${d}" — must be YYYY-MM-DD`)
  }
  return d
}

export interface RefineApplyOpts {
  id: string
  duration?: number
  buffer?: number
  priority?: string
  deadline?: string
  notes?: string
  tags?: string[]
  removeTags?: string[]
  dryRun?: boolean
}

export function refineApply(opts: RefineApplyOpts): RefineApplyResult {
  const { items } = readInbox()
  const item = findItemById(items, opts.id)
  if (!item) {
    return { found: false, id: opts.id }
  }
  const updates: ApplyUpdates = {
    duration: opts.duration,
    buffer: opts.buffer,
    priority: validatePriority(opts.priority),
    deadline: validateDeadline(opts.deadline),
    notes: opts.notes,
    addTags: opts.tags,
    removeTags: opts.removeTags,
  }
  const newLines = buildItemBlock(item, updates)

  if (opts.dryRun) {
    const before = readInbox().lines.slice(item.startLine, item.endLine + 1)
    const same = before.length === newLines.length && before.every((l, i) => l === newLines[i])
    return {
      found: true,
      id: item.id,
      title: item.title,
      fieldsApplied: updates,
      dryRun: true,
      changed: !same,
      before,
      after: newLines,
    }
  }

  const result = writeInboxReplace(item.id, newLines)
  const refreshed = readInbox()
  const after = findItemById(refreshed.items, item.id)
  const refined = after ? classifyMissing(after).refined : false
  return {
    found: true,
    id: item.id,
    title: item.title,
    fieldsApplied: updates,
    refined,
    changed: result.changed,
    before: result.before,
    after: result.after,
    dryRun: false,
  }
}

export interface RefineDeleteResult {
  found: boolean
  id: string
  title?: string
  removed?: boolean
}

export function refineDelete(opts: { id: string }): RefineDeleteResult {
  const { items } = readInbox()
  const item = findItemById(items, opts.id)
  if (!item) {
    return { found: false, id: opts.id }
  }
  const result = writeInboxRemove(item.id)
  return { found: true, id: item.id, title: result.title, removed: true }
}

export function formatRefineBriefingHuman(b: RefineBriefing): string {
  const lines: string[] = []
  lines.push(`Inbox: ${b.inboxPath}`)
  lines.push(`Items: ${b.totalItems} active — ${b.refinedCount} refined, ${b.unrefinedCount} need refinement`)
  if (b.items.length === 0) {
    lines.push('')
    lines.push('Nothing to refine.')
    return lines.join('\n')
  }
  lines.push('')
  for (const it of b.items) {
    const tagStr = it.tags.length > 0 ? '  ' + it.tags.map(t => `#${t}`).join(' ') : ''
    lines.push(`[${it.id}] ${it.title}${tagStr}`)
    if (it.captured) lines.push(`  captured ${it.captured}`)
    const missingStr = it.missing.join(', ')
    lines.push(`  missing: ${missingStr}`)
    const fieldKeys = Object.keys(it.existingFields).filter(k => k !== 'captured')
    if (fieldKeys.length > 0) {
      const summary = fieldKeys.map(k => `${k}=${it.existingFields[k]}`).join(', ')
      lines.push(`  has: ${summary}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

export function formatRefineApplyHuman(r: RefineApplyResult): string {
  if (!r.found) return `Item not found: ${r.id}`
  const verb = r.dryRun ? 'Would update' : r.changed ? 'Updated' : 'No change'
  const refinedStr = r.refined ? ' (now fully refined)' : ''
  return `${verb}: [${r.id}] ${r.title}${refinedStr}`
}

export function formatRefineDeleteHuman(r: RefineDeleteResult): string {
  if (!r.found) return `Item not found: ${r.id}`
  return `Deleted: [${r.id}] ${r.title}`
}
