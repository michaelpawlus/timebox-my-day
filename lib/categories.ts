import { BlockCategory } from './types'

export const CATEGORY_COLORS: Record<BlockCategory, string> = {
  meal: '#f59e0b',     // amber
  exercise: '#10b981', // emerald
  meeting: '#6366f1',  // indigo
  focus: '#3b82f6',    // blue
  break: '#a78bfa',    // violet
  other: '#3b82f6',    // default blue
}

const CATEGORY_KEYWORDS: Record<BlockCategory, string[]> = {
  meal: ['lunch', 'dinner', 'breakfast', 'snack', 'brunch', 'meal', 'eat'],
  exercise: ['run', 'gym', 'workout', 'yoga', 'walk', 'swim', 'jog', 'exercise', 'hike', 'bike'],
  meeting: ['meeting', 'standup', 'call', 'sync', '1:1', 'review', 'scrum', 'retro', 'demo'],
  focus: ['focus', 'deep work', 'coding', 'writing', 'study', 'research', 'work'],
  break: ['break', 'rest', 'nap', 'relax', 'recharge'],
  other: [],
}

// Fallback palette for 'other' category blocks to get distinct colors
const FALLBACK_PALETTE = [
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
]
let fallbackIndex = 0

export function detectCategory(title: string): BlockCategory {
  const lower = title.toLowerCase()
  // Check categories in order of specificity
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'other') continue
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category as BlockCategory
      }
    }
  }
  return 'other'
}

export function getColorForTitle(title: string): { color: string; category: BlockCategory } {
  const category = detectCategory(title)
  if (category === 'other') {
    const color = FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length]
    fallbackIndex++
    return { color, category }
  }
  return { color: CATEGORY_COLORS[category], category }
}

export function darkenColor(hex: string): string {
  // Remove # prefix
  const raw = hex.replace('#', '')
  const r = Math.max(0, parseInt(raw.substring(0, 2), 16) - 40)
  const g = Math.max(0, parseInt(raw.substring(2, 4), 16) - 40)
  const b = Math.max(0, parseInt(raw.substring(4, 6), 16) - 40)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function lightenColor(hex: string): string {
  const raw = hex.replace('#', '')
  const r = Math.min(255, parseInt(raw.substring(0, 2), 16) + 40)
  const g = Math.min(255, parseInt(raw.substring(2, 4), 16) + 40)
  const b = Math.min(255, parseInt(raw.substring(4, 6), 16) + 40)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
