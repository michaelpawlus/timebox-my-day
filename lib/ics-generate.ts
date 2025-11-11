import { PlanBlock } from './types'
import { parseISO, format } from 'date-fns'

function formatICSDate(date: Date): string {
  // Format as UTC: YYYYMMDDTHHmmssZ
  return format(date, "yyyyMMdd'T'HHmmss'Z'")
}

function generateUID(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${random}@timeboxer.app`
}

function escapeICSText(text: string): string {
  // Escape special characters per RFC 5545
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  // RFC 5545: Lines should be folded at 75 octets
  if (line.length <= 75) return line
  
  const lines: string[] = []
  let currentLine = line.substring(0, 75)
  let remaining = line.substring(75)
  
  lines.push(currentLine)
  
  while (remaining.length > 0) {
    currentLine = ' ' + remaining.substring(0, 74) // Space prefix for continuation
    remaining = remaining.substring(74)
    lines.push(currentLine)
  }
  
  return lines.join('\r\n')
}

export function generateICS(planBlocks: PlanBlock[], fileName?: string): string {
  const now = new Date()
  const timestamp = formatICSDate(now)
  
  let icsContent = 'BEGIN:VCALENDAR\r\n'
  icsContent += 'VERSION:2.0\r\n'
  icsContent += 'PRODID:-//Time-Box My Day//Timeboxer v0.1//EN\r\n'
  icsContent += 'CALSCALE:GREGORIAN\r\n'
  icsContent += 'METHOD:PUBLISH\r\n'
  
  for (const block of planBlocks) {
    const startDate = parseISO(block.start)
    const endDate = parseISO(block.end)
    
    // Convert to UTC
    const startUTC = new Date(startDate.getTime())
    const endUTC = new Date(endDate.getTime())
    
    icsContent += 'BEGIN:VEVENT\r\n'
    icsContent += `UID:${generateUID()}\r\n`
    icsContent += `DTSTAMP:${timestamp}\r\n`
    icsContent += `DTSTART:${formatICSDate(startUTC)}\r\n`
    icsContent += `DTEND:${formatICSDate(endUTC)}\r\n`
    icsContent += foldLine(`SUMMARY:${escapeICSText(block.title)}`) + '\r\n'
    
    if (block.location) {
      icsContent += foldLine(`LOCATION:${escapeICSText(block.location)}`) + '\r\n'
    }
    
    if (block.notes) {
      icsContent += foldLine(`DESCRIPTION:${escapeICSText(block.notes)}`) + '\r\n'
    }
    
    icsContent += 'STATUS:CONFIRMED\r\n'
    icsContent += 'SEQUENCE:0\r\n'
    icsContent += 'END:VEVENT\r\n'
  }
  
  icsContent += 'END:VCALENDAR\r\n'
  
  return icsContent
}

export function downloadICS(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportPlanBlocks(planBlocks: PlanBlock[], date?: Date): void {
  if (planBlocks.length === 0) {
    alert('No plan blocks to export')
    return
  }
  
  const dateStr = date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  const fileName = `timebox-plan-${dateStr}.ics`
  const icsContent = generateICS(planBlocks)
  downloadICS(icsContent, fileName)
}

