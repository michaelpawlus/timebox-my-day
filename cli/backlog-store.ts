import * as fs from 'fs'
import * as path from 'path'
import { BacklogItem } from '../lib/types'
import { Backlog } from './types'

const STORE_DIR = path.join(process.env.HOME || '~', '.timebox')
const BACKLOG_FILE = path.join(STORE_DIR, 'backlog.json')

function ensureDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true })
  }
}

function emptyBacklog(): Backlog {
  return { items: [] }
}

function readBacklog(): Backlog {
  ensureDir()
  if (!fs.existsSync(BACKLOG_FILE)) {
    return emptyBacklog()
  }
  try {
    const raw = fs.readFileSync(BACKLOG_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return emptyBacklog()
  }
}

function writeBacklog(backlog: Backlog): void {
  ensureDir()
  fs.writeFileSync(BACKLOG_FILE, JSON.stringify(backlog, null, 2), 'utf-8')
}

export function getBacklog(): Backlog {
  return readBacklog()
}

export function addBacklogItem(item: BacklogItem): Backlog {
  const backlog = readBacklog()
  backlog.items.push(item)
  writeBacklog(backlog)
  return backlog
}

export function updateBacklogItem(
  id: string,
  updates: Partial<Omit<BacklogItem, 'id' | 'createdAt'>>,
): { backlog: Backlog; found: boolean } {
  const backlog = readBacklog()
  const item = backlog.items.find(i => i.id === id)
  if (!item) {
    return { backlog, found: false }
  }
  Object.assign(item, updates)
  writeBacklog(backlog)
  return { backlog, found: true }
}

export function removeBacklogItem(id: string): { backlog: Backlog; found: boolean } {
  const backlog = readBacklog()
  const idx = backlog.items.findIndex(i => i.id === id)
  if (idx < 0) {
    return { backlog, found: false }
  }
  backlog.items.splice(idx, 1)
  writeBacklog(backlog)
  return { backlog, found: true }
}

export function completeBacklogItem(id: string): { backlog: Backlog; found: boolean } {
  return updateBacklogItem(id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  })
}
