import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  CatalogIssue,
  CatalogRepoSummary,
  CodeCatalog,
  ImpactScore,
  LoeScore,
  ScoreSource,
  catalogPath,
  readCatalog,
  writeCatalog,
} from '../catalog-store'

const execFileP = promisify(execFile)

const PROJECTS_ROOT = path.join(process.env.HOME || '~', 'projects')
const SKIP_MARKER = '.timebox-skip'
const REFRESH_CONCURRENCY = 6
const GH_TIMEOUT_MS = 30_000

interface DiscoveredRepo {
  name: string                // owner/name
  path: string                // local filesystem path
}

interface GhIssueRaw {
  number: number
  title: string
  body?: string
  labels?: Array<{ name: string } | string>
  url: string
  createdAt: string
  updatedAt: string
}

// ---------- Repo discovery ----------

async function getRemoteOwnerName(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileP('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], {
      timeout: 5_000,
    })
    return parseOwnerNameFromRemote(stdout.trim())
  } catch {
    return null
  }
}

function parseOwnerNameFromRemote(url: string): string | null {
  // Handles: https://github.com/owner/name(.git), git@github.com:owner/name(.git)
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!m) return null
  return `${m[1]}/${m[2]}`
}

export async function discoverRepos(root: string = PROJECTS_ROOT): Promise<DiscoveredRepo[]> {
  if (!fs.existsSync(root)) return []
  const entries = fs.readdirSync(root, { withFileTypes: true })
  const candidates: string[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const full = path.join(root, e.name)
    if (!fs.existsSync(path.join(full, '.git'))) continue
    if (fs.existsSync(path.join(full, SKIP_MARKER))) continue
    candidates.push(full)
  }
  const resolved = await Promise.all(
    candidates.map(async (p) => {
      const name = await getRemoteOwnerName(p)
      return name ? { name, path: p } : null
    })
  )
  return resolved.filter((r): r is DiscoveredRepo => r !== null)
}

// ---------- Issue fetching ----------

async function fetchOpenIssues(repoPath: string): Promise<{ issues: GhIssueRaw[]; error?: string }> {
  try {
    const { stdout } = await execFileP(
      'gh',
      [
        'issue',
        'list',
        '--state=open',
        '--limit=200',
        '--json=number,title,body,labels,url,createdAt,updatedAt',
      ],
      { cwd: repoPath, timeout: GH_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    )
    const parsed = JSON.parse(stdout) as GhIssueRaw[]
    return { issues: parsed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { issues: [], error: msg.split('\n')[0].slice(0, 200) }
  }
}

// ---------- Scoring ----------

const LOE_LABEL_PATTERNS: Array<[RegExp, LoeScore]> = [
  [/^loe[:/-]?\s*xl$/i, 'XL'],
  [/^loe[:/-]?\s*l$/i, 'L'],
  [/^loe[:/-]?\s*m$/i, 'M'],
  [/^loe[:/-]?\s*s$/i, 'S'],
  [/^size[:/-]?\s*xl$/i, 'XL'],
  [/^size[:/-]?\s*l$/i, 'L'],
  [/^size[:/-]?\s*m$/i, 'M'],
  [/^size[:/-]?\s*s$/i, 'S'],
]

const IMPACT_LABEL_PATTERNS: Array<[RegExp, ImpactScore]> = [
  [/^impact[:/-]?\s*high$/i, 'high'],
  [/^impact[:/-]?\s*med(ium)?$/i, 'med'],
  [/^impact[:/-]?\s*low$/i, 'low'],
  [/^priority[:/-]?\s*p?[01]$/i, 'high'],
]

const LOE_INFERRED_LABELS: Record<string, LoeScore> = {
  'good first issue': 'S',
  'easy': 'S',
  'small': 'S',
  'quick': 'S',
  'tiny': 'S',
  'medium': 'M',
  'large': 'L',
  'big': 'L',
  'epic': 'XL',
  'multi-week': 'XL',
  'huge': 'XL',
}

const HIGH_IMPACT_LABELS = new Set(['bug', 'critical', 'urgent', 'p0', 'p1', 'security', 'regression'])
const MED_IMPACT_LABELS = new Set(['feature', 'enhancement', 'feature-request', 'improvement'])
const LOW_IMPACT_LABELS = new Set(['documentation', 'docs', 'chore', 'refactor', 'cleanup', 'nit'])

function normalizeLabels(raw: GhIssueRaw['labels']): string[] {
  if (!raw) return []
  return raw.map((l) => (typeof l === 'string' ? l : l.name)).filter((n): n is string => !!n)
}

export function scoreLoe(labels: string[], bodyLength: number): { loe: LoeScore; source: ScoreSource } {
  for (const label of labels) {
    for (const [pattern, score] of LOE_LABEL_PATTERNS) {
      if (pattern.test(label)) return { loe: score, source: 'label' }
    }
  }
  for (const label of labels) {
    const hit = LOE_INFERRED_LABELS[label.toLowerCase()]
    if (hit) return { loe: hit, source: 'inferred-label' }
  }
  // Fall back to body length as a weak signal
  if (bodyLength === 0) return { loe: 'M', source: 'default' }
  if (bodyLength < 200) return { loe: 'S', source: 'inferred-length' }
  if (bodyLength < 800) return { loe: 'M', source: 'inferred-length' }
  if (bodyLength < 2000) return { loe: 'L', source: 'inferred-length' }
  return { loe: 'XL', source: 'inferred-length' }
}

export function scoreImpact(labels: string[]): { impact: ImpactScore; source: ScoreSource } {
  for (const label of labels) {
    for (const [pattern, score] of IMPACT_LABEL_PATTERNS) {
      if (pattern.test(label)) return { impact: score, source: 'label' }
    }
  }
  const lowered = labels.map((l) => l.toLowerCase())
  if (lowered.some((l) => HIGH_IMPACT_LABELS.has(l))) return { impact: 'high', source: 'inferred-label' }
  if (lowered.some((l) => MED_IMPACT_LABELS.has(l))) return { impact: 'med', source: 'inferred-label' }
  if (lowered.some((l) => LOW_IMPACT_LABELS.has(l))) return { impact: 'low', source: 'inferred-label' }
  return { impact: 'med', source: 'default' }
}

function toCatalogIssue(repo: string, raw: GhIssueRaw): CatalogIssue {
  const labels = normalizeLabels(raw.labels)
  const bodyLength = (raw.body || '').length
  const { loe, source: loeSource } = scoreLoe(labels, bodyLength)
  const { impact, source: impactSource } = scoreImpact(labels)
  return {
    id: `${repo}#${raw.number}`,
    repo,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    labels,
    loe,
    loeSource,
    impact,
    impactSource,
    bodyLength,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

// ---------- Concurrency-limited refresh ----------

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

// ---------- Commands ----------

export interface RefreshResult {
  catalogPath: string
  lastRefreshed: string
  reposScanned: number
  reposWithErrors: number
  issueCount: number
  repos: CatalogRepoSummary[]
}

export async function refreshCatalog(opts: { root?: string } = {}): Promise<RefreshResult> {
  const root = opts.root || PROJECTS_ROOT
  const repos = await discoverRepos(root)

  const perRepo = await mapWithLimit(repos, REFRESH_CONCURRENCY, async (r) => {
    const { issues, error } = await fetchOpenIssues(r.path)
    return { repo: r, issues, error }
  })

  const allIssues: CatalogIssue[] = []
  const repoSummaries: CatalogRepoSummary[] = []

  for (const { repo, issues, error } of perRepo) {
    const catalogIssues = issues.map((i) => toCatalogIssue(repo.name, i))
    allIssues.push(...catalogIssues)
    repoSummaries.push({
      name: repo.name,
      path: repo.path,
      issueCount: catalogIssues.length,
      ...(error ? { error } : {}),
    })
  }

  // Sort: high-impact first, then by recency of updates
  allIssues.sort((a, b) => {
    const impactRank: Record<ImpactScore, number> = { high: 0, med: 1, low: 2 }
    const ai = impactRank[a.impact], bi = impactRank[b.impact]
    if (ai !== bi) return ai - bi
    return (b.updatedAt || '').localeCompare(a.updatedAt || '')
  })

  const catalog: CodeCatalog = {
    lastRefreshed: new Date().toISOString(),
    repos: repoSummaries.sort((a, b) => a.name.localeCompare(b.name)),
    issues: allIssues,
  }

  const written = writeCatalog(catalog)

  return {
    catalogPath: written,
    lastRefreshed: catalog.lastRefreshed,
    reposScanned: repoSummaries.length,
    reposWithErrors: repoSummaries.filter((r) => r.error).length,
    issueCount: allIssues.length,
    repos: repoSummaries,
  }
}

export interface ListOpts {
  repo?: string         // substring match against owner/name
  maxLoe?: LoeScore     // include issues with LOE <= maxLoe
  impact?: ImpactScore
}

export interface ListResult {
  catalogPath: string
  lastRefreshed: string | null
  count: number
  issues: CatalogIssue[]
}

const LOE_RANK: Record<LoeScore, number> = { S: 0, M: 1, L: 2, XL: 3 }

export function listCatalog(opts: ListOpts = {}): ListResult {
  const catalog = readCatalog()
  if (!catalog) {
    return { catalogPath: catalogPath(), lastRefreshed: null, count: 0, issues: [] }
  }
  let issues = catalog.issues
  if (opts.repo) {
    const needle = opts.repo.toLowerCase()
    issues = issues.filter((i) => i.repo.toLowerCase().includes(needle))
  }
  if (opts.maxLoe) {
    const cap = LOE_RANK[opts.maxLoe]
    issues = issues.filter((i) => LOE_RANK[i.loe] <= cap)
  }
  if (opts.impact) {
    issues = issues.filter((i) => i.impact === opts.impact)
  }
  return {
    catalogPath: catalogPath(),
    lastRefreshed: catalog.lastRefreshed,
    count: issues.length,
    issues,
  }
}

// ---------- Human formatters ----------

export function formatRefreshHuman(r: RefreshResult): string {
  const lines = [
    `Refreshed catalog at ${r.catalogPath}`,
    `  ${r.reposScanned} repos scanned, ${r.issueCount} open issues`,
  ]
  if (r.reposWithErrors > 0) {
    lines.push(`  ${r.reposWithErrors} repo(s) returned errors:`)
    for (const repo of r.repos) {
      if (repo.error) lines.push(`    - ${repo.name}: ${repo.error}`)
    }
  }
  const withIssues = r.repos.filter((repo) => repo.issueCount > 0)
  if (withIssues.length > 0) {
    lines.push('  Repos with issues:')
    for (const repo of withIssues) {
      lines.push(`    ${repo.name.padEnd(45)} ${repo.issueCount}`)
    }
  }
  return lines.join('\n')
}

export function formatListHuman(r: ListResult): string {
  if (r.lastRefreshed === null) {
    return 'No catalog yet — run `timebox catalog refresh` first.'
  }
  if (r.count === 0) {
    return `No issues match (catalog last refreshed ${r.lastRefreshed}).`
  }
  const lines = [`${r.count} issue(s) — last refreshed ${r.lastRefreshed}`]
  for (const issue of r.issues) {
    const tag = `[${issue.loe}/${issue.impact}]`.padEnd(11)
    lines.push(`  ${tag} ${issue.repo}#${issue.number}  ${issue.title}`)
  }
  return lines.join('\n')
}
