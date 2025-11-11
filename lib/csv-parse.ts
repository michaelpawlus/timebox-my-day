import Papa from 'papaparse'
import { z } from 'zod'
import { CSVRow } from './types'

// Zod schema for CSV validation
const csvRowSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  start: z.string().min(1, 'Start time is required'),
  end: z.string().min(1, 'End time is required'),
  location: z.string().optional(),
  description: z.string().optional(),
  timezone: z.string().optional(),
})

export interface ParsedCSVRow extends CSVRow {
  rowNumber: number
  isValid: boolean
  errors: string[]
}

export interface CSVParseResult {
  rows: ParsedCSVRow[]
  validCount: number
  invalidCount: number
  hasErrors: boolean
}

function normalizeDateTime(dateStr: string): string {
  // Handle various formats: "2025-11-12T13:00" or "2025-11-12 13:00"
  return dateStr.replace(' ', 'T')
}

function validateDateTime(dateStr: string): boolean {
  try {
    const normalized = normalizeDateTime(dateStr)
    const date = new Date(normalized)
    return !isNaN(date.getTime())
  } catch {
    return false
  }
}

export function parseCSV(fileContent: string): CSVParseResult {
  const parseResult = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.toLowerCase().trim(),
  })

  const rows: ParsedCSVRow[] = []
  let validCount = 0
  let invalidCount = 0

  parseResult.data.forEach((row: any, index: number) => {
    const errors: string[] = []
    
    // Validate using Zod
    const validationResult = csvRowSchema.safeParse(row)
    
    if (!validationResult.success) {
      validationResult.error.issues.forEach((issue) => {
        errors.push(`${issue.path.join('.')}: ${issue.message}`)
      })
    } else {
      // Additional validation for date formats
      if (!validateDateTime(row.start)) {
        errors.push('start: Invalid date/time format (use ISO 8601: YYYY-MM-DDTHH:mm)')
      }
      if (!validateDateTime(row.end)) {
        errors.push('end: Invalid date/time format (use ISO 8601: YYYY-MM-DDTHH:mm)')
      }
      
      // Check that end is after start
      if (errors.length === 0) {
        const startDate = new Date(normalizeDateTime(row.start))
        const endDate = new Date(normalizeDateTime(row.end))
        if (endDate <= startDate) {
          errors.push('End time must be after start time')
        }
      }
    }

    const isValid = errors.length === 0
    if (isValid) {
      validCount++
    } else {
      invalidCount++
    }

    rows.push({
      rowNumber: index + 2, // +2 because header is row 1, and array is 0-indexed
      title: row.title || '',
      start: row.start || '',
      end: row.end || '',
      location: row.location,
      description: row.description,
      timezone: row.timezone,
      isValid,
      errors,
    })
  })

  return {
    rows,
    validCount,
    invalidCount,
    hasErrors: invalidCount > 0,
  }
}

export function csvRowsToICS(rows: ParsedCSVRow[]): string {
  // Filter only valid rows
  const validRows = rows.filter(row => row.isValid)
  
  if (validRows.length === 0) {
    throw new Error('No valid rows to export')
  }

  const now = new Date()
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  
  let icsContent = 'BEGIN:VCALENDAR\r\n'
  icsContent += 'VERSION:2.0\r\n'
  icsContent += 'PRODID:-//Time-Box My Day//CSV Import//EN\r\n'
  icsContent += 'CALSCALE:GREGORIAN\r\n'
  
  validRows.forEach((row) => {
    const startDate = new Date(normalizeDateTime(row.start))
    const endDate = new Date(normalizeDateTime(row.end))
    
    // Convert to UTC
    const startUTC = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const endUTC = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    
    const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@timeboxer.app`
    
    icsContent += 'BEGIN:VEVENT\r\n'
    icsContent += `UID:${uid}\r\n`
    icsContent += `DTSTAMP:${timestamp}\r\n`
    icsContent += `DTSTART:${startUTC}\r\n`
    icsContent += `DTEND:${endUTC}\r\n`
    icsContent += `SUMMARY:${row.title.replace(/[,;\\]/g, (m) => '\\' + m)}\r\n`
    
    if (row.location) {
      icsContent += `LOCATION:${row.location.replace(/[,;\\]/g, (m) => '\\' + m)}\r\n`
    }
    
    if (row.description) {
      icsContent += `DESCRIPTION:${row.description.replace(/[,;\\]/g, (m) => '\\' + m)}\r\n`
    }
    
    icsContent += 'END:VEVENT\r\n'
  })
  
  icsContent += 'END:VCALENDAR\r\n'
  
  return icsContent
}

