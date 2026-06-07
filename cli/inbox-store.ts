import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export interface InboxItem {
  id: string
  title: string
  done: boolean
  tags: string[]
  fields: Record<string, string>
  startLine: number
  endLine: number
}

export type MissingField = 'duration' | 'priority' | 'domainTag'

export type InboxStatus = 'pending' | 'scheduled' | 'completed'

export function getInboxPath(): string {
  const vault = process.env.OBSIDIAN_VAULT_PATH
  if (!vault) {
    throw new Error('OBSIDIAN_VAULT_PATH is not set')
  }
  return path.join(vault, 'backlog', 'inbox.md')
}

export function computeItemId(title: string, captured: string): string {
  return crypto.createHash('sha1').update(`${title}|${captured}`).digest('hex').slice(0, 8)
}

const ITEM_LINE_RE = /^- \[( |x)\]\s+(.+?)\s*$/
const FIELD_LINE_RE = /^\s{2,}([a-zA-Z][a-zA-Z0-9_-]*)::\s*(.*)$/

function splitTitleAndTags(rest: string): { title: string; tags: string[] } {
  const tags: string[] = []
  const tokens = rest.split(/\s+/)
  let cut = tokens.length
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].startsWith('#')) {
      cut = i
    } else {
      break
    }
  }
  for (let i = cut; i < tokens.length; i++) {
    const t = tokens[i].replace(/^#/, '').trim()
    if (t.length > 0) tags.push(t)
  }
  const title = tokens.slice(0, cut).join(' ').trim()
  return { title, tags }
}

export interface InboxRead {
  path: string
  raw: string
  lines: string[]
  items: InboxItem[]
}

export function readInbox(): InboxRead {
  const p = getInboxPath()
  const raw = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
  const lines = raw.split('\n')
  const items: InboxItem[] = []

  let current: InboxItem | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const itemMatch = line.match(ITEM_LINE_RE)
    if (itemMatch) {
      if (current) {
        items.push(current)
      }
      const done = itemMatch[1] === 'x'
      const { title, tags } = splitTitleAndTags(itemMatch[2])
      current = {
        id: '',
        title,
        done,
        tags,
        fields: {},
        startLine: i,
        endLine: i,
      }
      continue
    }
    if (current) {
      const fieldMatch = line.match(FIELD_LINE_RE)
      if (fieldMatch) {
        current.fields[fieldMatch[1]] = fieldMatch[2].trim()
        current.endLine = i
        continue
      }
      if (line.trim() === '') {
        continue
      }
      items.push(current)
      current = null
    }
  }
  if (current) items.push(current)

  for (const item of items) {
    item.id = computeItemId(item.title, item.fields.captured || '')
  }
  return { path: p, raw, lines, items }
}

export function findItemById(items: InboxItem[], id: string): InboxItem | undefined {
  return items.find(it => it.id === id)
}

export function itemStatus(item: InboxItem): InboxStatus {
  if (item.done) return 'completed'
  if ((item.fields.status || '').toLowerCase() === 'scheduled') return 'scheduled'
  return 'pending'
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function classifyMissing(item: InboxItem): { missing: MissingField[]; refined: boolean } {
  const missing: MissingField[] = []
  if (!item.fields.duration) missing.push('duration')
  if (!item.fields.priority) missing.push('priority')
  const hasDomain = item.tags.some(t => t.startsWith('task/'))
  if (!hasDomain) missing.push('domainTag')
  return { missing, refined: missing.length === 0 }
}

export interface ApplyUpdates {
  title?: string
  duration?: number
  buffer?: number
  priority?: 'hard' | 'soft' | 'none'
  deadline?: string
  notes?: string
  status?: InboxStatus
  done?: boolean
  completed?: string
  addTags?: string[]
  removeTags?: string[]
}

const FIELD_ORDER = ['duration', 'buffer', 'priority', 'status', 'deadline', 'captured', 'completed', 'notes']

export function buildItemBlock(item: InboxItem, updates: ApplyUpdates = {}): string[] {
  const removeSet = new Set((updates.removeTags || []).map(t => t.replace(/^#/, '')))
  const tags = item.tags.filter(t => !removeSet.has(t))
  for (const t of updates.addTags || []) {
    const norm = t.replace(/^#/, '').trim()
    if (norm.length > 0 && !tags.includes(norm)) tags.push(norm)
  }
  const title = updates.title !== undefined ? updates.title : item.title

  const fields: Record<string, string> = { ...item.fields }
  if (updates.duration !== undefined) fields.duration = String(updates.duration)
  if (updates.buffer !== undefined) fields.buffer = String(updates.buffer)
  if (updates.priority !== undefined) fields.priority = updates.priority
  if (updates.deadline !== undefined) fields.deadline = updates.deadline
  if (updates.notes !== undefined) fields.notes = updates.notes

  // Status drives both the checkbox and the status::/completed:: fields.
  let done = item.done
  if (updates.status !== undefined) {
    if (updates.status === 'completed') {
      done = true
      delete fields.status
      if (!fields.completed) fields.completed = updates.completed || todayISO()
    } else if (updates.status === 'scheduled') {
      done = false
      fields.status = 'scheduled'
      delete fields.completed
    } else {
      done = false
      delete fields.status
      delete fields.completed
    }
  }
  if (updates.completed !== undefined) fields.completed = updates.completed
  if (updates.done !== undefined) done = updates.done

  const checkbox = done ? '[x]' : '[ ]'
  const tagStr = tags.map(t => `#${t}`).join(' ')
  const titleLine = tagStr ? `- ${checkbox} ${title} ${tagStr}` : `- ${checkbox} ${title}`

  const orderedKeys: string[] = []
  for (const k of FIELD_ORDER) {
    if (fields[k] !== undefined) orderedKeys.push(k)
  }
  for (const k of Object.keys(fields)) {
    if (!orderedKeys.includes(k)) orderedKeys.push(k)
  }

  const fieldLines = orderedKeys.map(k => `  ${k}:: ${fields[k]}`)
  return [titleLine, ...fieldLines]
}

function writeAtomic(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

export interface ReplaceResult {
  changed: boolean
  before: string[]
  after: string[]
}

export function writeInboxReplace(itemId: string, newLines: string[]): ReplaceResult {
  const { path: p, lines, items } = readInbox()
  const item = findItemById(items, itemId)
  if (!item) {
    throw Object.assign(new Error(`Item not found: ${itemId}`), { code: 2 })
  }
  const before = lines.slice(item.startLine, item.endLine + 1)
  const sameLength = before.length === newLines.length
  const same = sameLength && before.every((l, i) => l === newLines[i])
  if (same) {
    return { changed: false, before, after: newLines }
  }
  const next = [...lines.slice(0, item.startLine), ...newLines, ...lines.slice(item.endLine + 1)]
  writeAtomic(p, next.join('\n'))
  return { changed: true, before, after: newLines }
}

export interface RemoveResult {
  removed: boolean
  title: string
  removedLines: string[]
}

export function writeInboxRemove(itemId: string): RemoveResult {
  const { path: p, lines, items } = readInbox()
  const item = findItemById(items, itemId)
  if (!item) {
    throw Object.assign(new Error(`Item not found: ${itemId}`), { code: 2 })
  }
  let endExclusive = item.endLine + 1
  if (endExclusive < lines.length && lines[endExclusive].trim() === '') {
    endExclusive += 1
  }
  const removedLines = lines.slice(item.startLine, endExclusive)
  const next = [...lines.slice(0, item.startLine), ...lines.slice(endExclusive)]
  writeAtomic(p, next.join('\n'))
  return { removed: true, title: item.title, removedLines }
}
