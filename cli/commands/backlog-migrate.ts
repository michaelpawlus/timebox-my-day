import * as fs from 'fs'
import * as path from 'path'
import { BacklogItem } from '../../lib/types'
import { captureItem } from './capture'
import {
  InboxStatus,
  buildItemBlock,
  computeItemId,
  findItemById,
  readInbox,
  writeInboxReplace,
} from '../inbox-store'

// One-time migration: move items from the legacy ~/.timebox/backlog.json store
// into the canonical Obsidian inbox.md. Dedupes by content-hash id so re-running
// is safe. On success the JSON file is renamed to backlog.json.bak.

const STORE_DIR = path.join(process.env.HOME || '~', '.timebox')
const BACKLOG_FILE = path.join(STORE_DIR, 'backlog.json')

const PRIORITY_MAP: Record<string, 'hard' | 'soft' | 'none'> = {
  'hard-deadline': 'hard',
  'soft-deadline': 'soft',
  'no-deadline': 'none',
}

export interface MigrateResult {
  jsonPath: string
  jsonExists: boolean
  total: number
  migrated: string[]
  skipped: string[]
  backupPath?: string
  dryRun: boolean
}

function readLegacy(): BacklogItem[] {
  if (!fs.existsSync(BACKLOG_FILE)) return []
  try {
    const raw = fs.readFileSync(BACKLOG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

function tagsFor(item: BacklogItem): string[] {
  const tags: string[] = []
  if (item.constraints?.outdoor) tags.push('outdoor')
  if (item.constraints?.daylight) tags.push('daylight')
  if (item.constraints?.weekendOnly) tags.push('weekend')
  return tags
}

export function migrateBacklog(opts: { dryRun?: boolean } = {}): MigrateResult {
  const items = readLegacy()
  const result: MigrateResult = {
    jsonPath: BACKLOG_FILE,
    jsonExists: fs.existsSync(BACKLOG_FILE),
    total: items.length,
    migrated: [],
    skipped: [],
    dryRun: !!opts.dryRun,
  }

  if (!result.jsonExists) return result

  // Build the set of existing inbox ids so we don't double-import.
  const existing = new Set(readInbox().items.map(i => i.id))

  for (const item of items) {
    const priority = PRIORITY_MAP[item.priority] || 'none'
    // capture stamps captured:: with today; the id is computed from title + that
    // date, so dedupe is by what the item *would* become once captured.
    const captured = new Date().toISOString().slice(0, 10)
    const targetId = computeItemId(item.title, captured)
    if (existing.has(targetId)) {
      result.skipped.push(item.title)
      continue
    }

    if (!opts.dryRun) {
      captureItem({
        title: item.title,
        tags: tagsFor(item),
        duration: item.durationMinutes,
        priority,
        deadline: item.deadline,
      })
      // Preserve scheduled/completed status so done work doesn't resurface.
      const status = item.status as InboxStatus
      if (status === 'scheduled' || status === 'completed') {
        const refreshed = readInbox()
        const captured = findItemById(refreshed.items, targetId)
        if (captured) {
          const completed = item.completedAt ? item.completedAt.slice(0, 10) : undefined
          const lines = buildItemBlock(captured, { status, completed })
          writeInboxReplace(targetId, lines)
        }
      }
      existing.add(targetId)
    }
    result.migrated.push(item.title)
  }

  if (!opts.dryRun && result.migrated.length >= 0) {
    const backup = `${BACKLOG_FILE}.bak`
    fs.renameSync(BACKLOG_FILE, backup)
    result.backupPath = backup
  }

  return result
}

export function formatMigrateHuman(result: MigrateResult): string {
  if (!result.jsonExists) {
    return `No legacy backlog found at ${result.jsonPath} — nothing to migrate.`
  }
  const lines: string[] = []
  const verb = result.dryRun ? 'Would migrate' : 'Migrated'
  lines.push(`${verb} ${result.migrated.length} of ${result.total} item(s) from ${result.jsonPath}`)
  for (const t of result.migrated) lines.push(`  + ${t}`)
  if (result.skipped.length > 0) {
    lines.push(`Skipped ${result.skipped.length} already-present item(s):`)
    for (const t of result.skipped) lines.push(`  = ${t}`)
  }
  if (result.dryRun) {
    lines.push('(dry run — no changes written, JSON left in place)')
  } else if (result.backupPath) {
    lines.push(`Renamed legacy store to ${result.backupPath}`)
  }
  return lines.join('\n')
}
