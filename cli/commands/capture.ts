import * as fs from 'fs'
import * as path from 'path'

const INBOX_HEADER = `# Backlog Inbox

Captured tasks and ideas awaiting refinement and scheduling. Code work lives in GitHub issues — this file is for everything else (house tasks, errands, learning, personal projects, admin).

## Tag Taxonomy

**Domain:** \`#task/house\` \`#task/personal\` \`#task/learning\` \`#task/errand\` \`#task/admin\`
**Constraints:** \`#weekend\` \`#outdoor\` \`#daylight\` \`#offline\`

## Items
`

function getInboxPath(): string {
  const vault = process.env.OBSIDIAN_VAULT_PATH
  if (!vault) {
    throw new Error('OBSIDIAN_VAULT_PATH is not set')
  }
  return path.join(vault, 'backlog', 'inbox.md')
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeTag(tag: string): string {
  const trimmed = tag.trim().replace(/^#/, '')
  return trimmed
}

export interface CaptureOpts {
  title: string
  tags?: string[]
  duration?: number
  buffer?: number
  priority?: string
  deadline?: string
  notes?: string
}

export interface CaptureResult {
  title: string
  inbox: string
  appended: string
  capturedAt: string
}

export function captureItem(opts: CaptureOpts): CaptureResult {
  const inbox = getInboxPath()
  const dir = path.dirname(inbox)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(inbox)) {
    fs.writeFileSync(inbox, INBOX_HEADER, 'utf-8')
  }

  const tags = (opts.tags || []).map(normalizeTag).filter(t => t.length > 0)
  const tagStr = tags.map(t => `#${t}`).join(' ')
  const titleLine = tagStr ? `- [ ] ${opts.title} ${tagStr}` : `- [ ] ${opts.title}`

  const captured = todayISO()
  const fields: string[] = []
  if (opts.duration !== undefined) fields.push(`  duration:: ${opts.duration}`)
  if (opts.buffer !== undefined) fields.push(`  buffer:: ${opts.buffer}`)
  if (opts.priority) fields.push(`  priority:: ${opts.priority}`)
  if (opts.deadline) fields.push(`  deadline:: ${opts.deadline}`)
  fields.push(`  captured:: ${captured}`)
  if (opts.notes) fields.push(`  notes:: ${opts.notes}`)

  const block = '\n' + titleLine + '\n' + fields.join('\n') + '\n'
  fs.appendFileSync(inbox, block, 'utf-8')

  return {
    title: opts.title,
    inbox,
    appended: block.trim(),
    capturedAt: captured,
  }
}

export function formatCaptureHuman(result: CaptureResult): string {
  return `Captured to inbox: ${result.title}\n  ${result.inbox}`
}
