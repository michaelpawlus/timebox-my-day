import * as fs from 'fs'
import { parseICSFile } from '../../lib/ics-parse'
import { addBusyEvents } from '../store'

export async function importCalendar(filePath: string): Promise<{
  imported: number
  ignored: number
  ignored_reasons: string[]
}> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const result = parseICSFile(content, new Date())

  addBusyEvents(result.events)

  return {
    imported: result.events.length,
    ignored: result.ignoredCount,
    ignored_reasons: result.ignoredReasons,
  }
}

export function formatImportHuman(result: {
  imported: number
  ignored: number
  ignored_reasons: string[]
}): string {
  const lines = [`Imported ${result.imported} events`]
  if (result.ignored > 0) {
    lines.push(`Ignored ${result.ignored} events:`)
    for (const reason of result.ignored_reasons) {
      lines.push(`  - ${reason}`)
    }
  }
  return lines.join('\n')
}
