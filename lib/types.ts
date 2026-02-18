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

