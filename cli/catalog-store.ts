import * as fs from 'fs'
import * as path from 'path'

const STORE_DIR = path.join(process.env.HOME || '~', '.timebox')
const CATALOG_FILE = path.join(STORE_DIR, 'code-catalog.json')

export type LoeScore = 'S' | 'M' | 'L' | 'XL'
export type ImpactScore = 'low' | 'med' | 'high'
export type ScoreSource = 'label' | 'inferred-label' | 'inferred-length' | 'default'

export interface CatalogIssue {
  id: string                  // <repo>#<number>, e.g. "michaelpawlus/timebox-my-day#17"
  repo: string                // owner/name
  number: number
  title: string
  url: string
  labels: string[]
  loe: LoeScore
  loeSource: ScoreSource
  impact: ImpactScore
  impactSource: ScoreSource
  bodyLength: number          // characters in body, useful for re-scoring
  createdAt: string
  updatedAt: string
}

export interface CatalogRepoSummary {
  name: string                // owner/name
  path: string                // local filesystem path
  issueCount: number
  error?: string              // gh CLI error if any
}

export interface CodeCatalog {
  lastRefreshed: string       // ISO timestamp
  repos: CatalogRepoSummary[]
  issues: CatalogIssue[]
}

function ensureDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true })
  }
}

export function readCatalog(): CodeCatalog | null {
  if (!fs.existsSync(CATALOG_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8')) as CodeCatalog
  } catch {
    return null
  }
}

export function writeCatalog(catalog: CodeCatalog): string {
  ensureDir()
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf-8')
  return CATALOG_FILE
}

export function catalogPath(): string {
  return CATALOG_FILE
}
