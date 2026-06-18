import * as fs from 'fs'
import * as path from 'path'
import { getInboxPath, readInbox, writeAtomic } from '../inbox-store'

// Periodic sweep that moves completed (`- [x]`) items out of the working
// inbox.md and into a yearly archive file under
// $OBSIDIAN_VAULT_PATH/backlog/archive/<year>.md. Completed work doesn't need
// to clutter the file the refine/plan-day passes read every command, but it's
// worth keeping for retrospectives and weekly reviews — so we move, not delete.
//
// Eligibility is by age: an item is archived once its reference date is at
// least `olderThanDays` days in the past. The reference date is the item's
// `completed::` field, falling back to `captured::` when completion wasn't
// stamped. Items with neither date can't be aged safely, so they're left in
// place and surfaced in the result.

export interface ArchivedItem {
  id: string
  title: string
  date: string
  year: string
  ageDays: number
  archiveFile: string
}

export interface SkippedRecent {
  id: string
  title: string
  date: string
  ageDays: number
}

export interface SkippedNoDate {
  id: string
  title: string
}

export interface ArchiveResult {
  inboxPath: string
  archiveDir: string
  olderThanDays: number
  dryRun: boolean
  archived: ArchivedItem[]
  skippedRecent: SkippedRecent[]
  skippedNoDate: SkippedNoDate[]
  byFile: Record<string, number>
}

function getArchiveDir(): string {
  // backlog/inbox.md -> backlog/archive
  return path.join(path.dirname(getInboxPath()), 'archive')
}

function todayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function parseISODate(value: string): Date | null {
  const m = value.match(DATE_RE)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(Date.UTC(year, month - 1, day))
  // Reject impossible dates (e.g. 2026-13-40 rolling over).
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null
  }
  return d
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function ageInDays(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / MS_PER_DAY)
}

export function archiveBacklog(opts: { olderThanDays?: number; dryRun?: boolean } = {}): ArchiveResult {
  const olderThanDays = opts.olderThanDays ?? 30
  const dryRun = !!opts.dryRun
  const archiveDir = getArchiveDir()
  const { path: inboxPath, lines, items } = readInbox()
  const now = todayUTC()

  const result: ArchiveResult = {
    inboxPath,
    archiveDir,
    olderThanDays,
    dryRun,
    archived: [],
    skippedRecent: [],
    skippedNoDate: [],
    byFile: {},
  }

  // Collect the line ranges to drop from the inbox and the block text to append
  // to each year's archive file. We do this in a single pass and rewrite once,
  // so item ids (content hashes) can't drift mid-sweep.
  const deleteLines = new Set<number>()
  const appendByFile = new Map<string, string[]>()

  for (const item of items) {
    if (!item.done) continue

    const dateStr = item.fields.completed || item.fields.captured || ''
    const refDate = dateStr ? parseISODate(dateStr) : null
    if (!refDate) {
      result.skippedNoDate.push({ id: item.id, title: item.title })
      continue
    }

    const age = ageInDays(refDate, now)
    if (age < olderThanDays) {
      result.skippedRecent.push({ id: item.id, title: item.title, date: dateStr, ageDays: age })
      continue
    }

    const year = dateStr.slice(0, 4)
    const archiveFile = path.join(archiveDir, `${year}.md`)

    const block = lines.slice(item.startLine, item.endLine + 1)
    const bucket = appendByFile.get(archiveFile) || []
    bucket.push(block.join('\n'))
    appendByFile.set(archiveFile, bucket)

    // Drop the item's lines and one trailing blank separator, mirroring
    // writeInboxRemove so we don't leave double blank lines behind.
    for (let i = item.startLine; i <= item.endLine; i++) deleteLines.add(i)
    if (item.endLine + 1 < lines.length && lines[item.endLine + 1].trim() === '') {
      deleteLines.add(item.endLine + 1)
    }

    result.archived.push({ id: item.id, title: item.title, date: dateStr, year, ageDays: age, archiveFile })
    result.byFile[archiveFile] = (result.byFile[archiveFile] || 0) + 1
  }

  if (dryRun || result.archived.length === 0) {
    return result
  }

  // Append blocks to each year's archive file (creating the dir/file as needed).
  fs.mkdirSync(archiveDir, { recursive: true })
  for (const [file, blocks] of Array.from(appendByFile.entries())) {
    const exists = fs.existsSync(file)
    const prior = exists ? fs.readFileSync(file, 'utf-8') : ''
    const parts: string[] = []
    if (!exists) {
      const year = path.basename(file, '.md')
      parts.push(`# Archived backlog items — ${year}`, '')
    } else if (prior.length > 0 && !prior.endsWith('\n')) {
      parts.push('')
    }
    for (const block of blocks) {
      parts.push(block, '')
    }
    writeAtomic(file, prior + parts.join('\n'))
  }

  // Rewrite the inbox without the archived line ranges. Preserve a single
  // trailing newline so later appends (capture) keep the file tidy, even when
  // the archived item was the last block and took the final newline with it.
  const remaining = lines.filter((_, i) => !deleteLines.has(i))
  let nextInbox = remaining.join('\n')
  if (nextInbox.length > 0 && !nextInbox.endsWith('\n')) nextInbox += '\n'
  writeAtomic(inboxPath, nextInbox)

  return result
}

export function formatArchiveHuman(result: ArchiveResult): string {
  const out: string[] = []
  const verb = result.dryRun ? 'Would archive' : 'Archived'

  if (result.archived.length === 0) {
    out.push(`Nothing to archive — no completed items older than ${result.olderThanDays} day(s).`)
  } else {
    out.push(`${verb} ${result.archived.length} completed item(s) older than ${result.olderThanDays} day(s):`)
    for (const it of result.archived) {
      out.push(`  + ${it.title} (${it.date}, ${it.ageDays}d) → ${path.basename(it.archiveFile)}`)
    }
    const files = Object.keys(result.byFile)
    if (files.length > 0) {
      out.push(`Target: ${result.archiveDir}/`)
    }
  }

  if (result.skippedRecent.length > 0) {
    out.push(`Kept ${result.skippedRecent.length} completed item(s) still within the window:`)
    for (const it of result.skippedRecent) {
      out.push(`  = ${it.title} (${it.date}, ${it.ageDays}d)`)
    }
  }
  if (result.skippedNoDate.length > 0) {
    out.push(`Kept ${result.skippedNoDate.length} completed item(s) with no completed::/captured:: date:`)
    for (const it of result.skippedNoDate) {
      out.push(`  ? ${it.title}`)
    }
  }
  if (result.dryRun && result.archived.length > 0) {
    out.push('(dry run — no changes written)')
  }
  return out.join('\n')
}
