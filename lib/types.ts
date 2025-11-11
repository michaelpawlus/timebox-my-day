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

// User-created plan blocks (editable)
export interface PlanBlock {
  id: string;            // uuid
  title: string;         // default "Focus Block"
  start: string;         // ISO 8601 in local time
  end: string;           // ISO 8601 in local time
  location?: string;
  notes?: string;
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

