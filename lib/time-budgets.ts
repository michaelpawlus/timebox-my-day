// Time-budget profiles for plan-day synthesis.
//
// A backlog item's "wall clock cost" is its core duration plus prep + recovery
// buffers. Profiles are keyed by a domain category derived from #task/<domain>
// tags. `buffer::` field on an inbox item overrides the category default
// (split evenly between prep and recovery).

export type DomainCategory =
  | 'house'
  | 'personal'
  | 'learning'
  | 'errand'
  | 'admin'
  | 'code'
  | 'meeting'
  | 'exercise'
  | 'other'

export interface TimeBudget {
  prep: number
  recovery: number
}

const DEFAULT_BUDGETS: Record<DomainCategory, TimeBudget> = {
  personal: { prep: 10, recovery: 45 },
  house: { prep: 5, recovery: 10 },
  errand: { prep: 5, recovery: 5 },
  learning: { prep: 5, recovery: 0 },
  admin: { prep: 0, recovery: 0 },
  code: { prep: 5, recovery: 0 },
  meeting: { prep: 0, recovery: 0 },
  exercise: { prep: 10, recovery: 30 },
  other: { prep: 0, recovery: 0 },
}

export function domainFromTags(tags: string[]): DomainCategory {
  for (const t of tags) {
    const m = t.match(/^task\/(\w+)/)
    if (m) {
      const candidate = m[1] as DomainCategory
      if (candidate in DEFAULT_BUDGETS) return candidate
    }
  }
  return 'other'
}

export function budgetFor(domain: DomainCategory, override?: number): TimeBudget {
  if (override !== undefined && override >= 0) {
    return { prep: Math.floor(override / 2), recovery: Math.ceil(override / 2) }
  }
  return DEFAULT_BUDGETS[domain]
}

export function totalMinutes(core: number, budget: TimeBudget): number {
  return core + budget.prep + budget.recovery
}
