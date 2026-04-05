// Calendar events parsed from ICS (read-only)
export interface BusyEvent {
  id: string;            // derived hash of DTSTART+DTEND+SUMMARY
  title: string;         // SUMMARY
  start: string;         // ISO 8601 in local time
  end: string;           // ISO 8601 in local time
  location?: string;
  source: 'ics' | 'csv-ics';
  allDay?: boolean;
}

// Block categories for color coding
export type BlockCategory = 'meal' | 'exercise' | 'meeting' | 'focus' | 'break' | 'other'

// Gap in a schedule (free time between blocks)
export interface Gap {
  start: string   // HH:MM
  end: string     // HH:MM
  duration_minutes: number
}

// Backlog system
export type TaskPriority = 'hard-deadline' | 'soft-deadline' | 'no-deadline'
export type TaskStatus = 'pending' | 'scheduled' | 'completed'

export interface TaskConstraints {
  outdoor?: boolean        // needs good weather
  daylight?: boolean       // needs daylight hours
  weekendOnly?: boolean    // only on weekends
  preferredWindow?: { start: string; end: string }  // HH:MM
}

export interface BacklogItem {
  id: string
  title: string
  durationMinutes: number
  priority: TaskPriority
  deadline?: string         // YYYY-MM-DD
  constraints: TaskConstraints
  category?: BlockCategory
  status: TaskStatus
  createdAt: string         // ISO 8601
  completedAt?: string      // ISO 8601
}

// User-created plan blocks (editable)
export interface PlanBlock {
  id: string;            // uuid
  title: string;         // default "Focus Block"
  start: string;         // ISO 8601 in local time
  end: string;           // ISO 8601 in local time
  location?: string;
  notes?: string;
  color: string;         // hex color for display
  category?: BlockCategory;
}

// Blocks in the holding area (not yet scheduled)
export interface UnscheduledBlock {
  id: string;
  title: string;
  durationMinutes: number;
  color: string;
  category?: BlockCategory;
}

// Intermediate result from text parsing
export interface ParsedBlockInput {
  title: string;
  durationMinutes: number;
  startMinutes?: number;  // minutes from midnight, if specified
  endMinutes?: number;    // minutes from midnight, if specified
  color: string;
  category?: BlockCategory;
}

// CSV row for validation
export interface CSVRow {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  timezone?: string;
}

// Conflict warning
export interface Conflict {
  planBlockId: string;
  conflictsWith: string; // id of busy event or another plan block
  type: 'busy' | 'plan';
}

// To-do list item
export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

