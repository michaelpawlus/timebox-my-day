'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Dropzone from './ui/Dropzone'
import { parseICSFile, readFileAsText, ParseResult } from '@/lib/ics-parse'
import { parseCSV, csvRowsToICS, CSVParseResult, ParsedCSVRow } from '@/lib/csv-parse'
import { downloadICS } from '@/lib/ics-generate'
import { useTimeBoxStore } from '@/lib/store'
import { getColorForTitle } from '@/lib/categories'
import { showSuccess, showError } from '@/lib/toast'
import { format } from 'date-fns'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'ics' | 'csv'

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ics')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [csvParseResult, setCSVParseResult] = useState<CSVParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadIntoPlanner, setLoadIntoPlanner] = useState(false)

  const { selectedDate, setBusyEvents, addPlanBlock } = useTimeBoxStore()

  const handleICSUpload = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setParseResult(null)

    try {
      const content = await readFileAsText(file)
      const result = parseICSFile(content, selectedDate)
      setParseResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse ICS file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = () => {
    if (parseResult) {
      setBusyEvents(parseResult.events)
      showSuccess(`Imported ${parseResult.events.length} events successfully!`)
      onClose()
      setParseResult(null)
    }
  }

  const handleCSVUpload = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setCSVParseResult(null)

    try {
      const content = await readFileAsText(file)
      const result = parseCSV(content)
      setCSVParseResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCSVExport = () => {
    if (!csvParseResult) return

    try {
      const icsContent = csvRowsToICS(csvParseResult.rows)
      const fileName = `csv-import-${format(new Date(), 'yyyy-MM-dd')}.ics`
      downloadICS(icsContent, fileName)

      if (loadIntoPlanner) {
        const validRows = csvParseResult.rows.filter(row => row.isValid)
        validRows.forEach(row => {
          const { color, category } = getColorForTitle(row.title)
          addPlanBlock({
            id: `csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: row.title,
            start: new Date(row.start.replace(' ', 'T')).toISOString(),
            end: new Date(row.end.replace(' ', 'T')).toISOString(),
            location: row.location,
            notes: row.description,
            color,
            category,
          })
        })
        showSuccess(`Exported ICS and loaded ${validRows.length} blocks into planner!`)
      } else {
        showSuccess(`Exported ${csvParseResult.validCount} events to ICS file!`)
      }

      onClose()
      setCSVParseResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export ICS')
    }
  }

  const handleClose = () => {
    setParseResult(null)
    setCSVParseResult(null)
    setError(null)
    setLoadIntoPlanner(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Calendar</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'ics'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('ics')}
          >
            Import ICS
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'csv'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('csv')}
          >
            CSV → ICS
          </button>
        </div>

        {/* ICS Tab */}
        {activeTab === 'ics' && (
          <div>
            <Dropzone
              onFileSelect={handleICSUpload}
              accept=".ics,.ical"
              label="Drop your .ics file here or click to browse"
            />

            {isLoading && (
              <div className="mt-4 text-center text-muted-foreground">
                Parsing calendar file...
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
              </div>
            )}

            {parseResult && (
              <div className="mt-6 space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Parse Results</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <li>Total events in file: {parseResult.totalEvents}</li>
                    <li>Events for selected date: {parseResult.events.length}</li>
                    {parseResult.ignoredCount > 0 && (
                      <li>Ignored events: {parseResult.ignoredCount}</li>
                    )}
                  </ul>
                </div>

                {parseResult.ignoredReasons.length > 0 && (
                  <details className="p-4 bg-muted border border-border rounded-lg">
                    <summary className="cursor-pointer font-medium text-muted-foreground">
                      View ignored events ({parseResult.ignoredReasons.length})
                    </summary>
                    <ul className="mt-2 text-sm text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                      {parseResult.ignoredReasons.slice(0, 20).map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                      {parseResult.ignoredReasons.length > 20 && (
                        <li>... and {parseResult.ignoredReasons.length - 20} more</li>
                      )}
                    </ul>
                  </details>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={parseResult.events.length === 0}
                  >
                    Import {parseResult.events.length} Event{parseResult.events.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            )}

            {!parseResult && !error && !isLoading && (
              <p className="mt-4 text-sm text-muted-foreground text-center">
                Upload your calendar file to see busy blocks for the selected date
              </p>
            )}
          </div>
        )}

        {/* CSV Tab */}
        {activeTab === 'csv' && (
          <div>
            <Dropzone
              onFileSelect={handleCSVUpload}
              accept=".csv"
              label="Drop your CSV file here or click to browse"
            />

            {isLoading && (
              <div className="mt-4 text-center text-muted-foreground">
                Parsing CSV file...
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
              </div>
            )}

            {csvParseResult && (
              <div className="mt-6 space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Parse Results</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <li>Total rows: {csvParseResult.rows.length}</li>
                    <li>Valid rows: {csvParseResult.validCount}</li>
                    {csvParseResult.invalidCount > 0 && (
                      <li className="text-red-700 dark:text-red-400">Invalid rows: {csvParseResult.invalidCount}</li>
                    )}
                  </ul>
                </div>

                {/* Preview table */}
                <div className="overflow-x-auto max-h-64 overflow-y-auto border border-border rounded-lg">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Row</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Title</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Start</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">End</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {csvParseResult.rows.map((row) => (
                        <tr key={row.rowNumber} className={row.isValid ? '' : 'bg-red-50 dark:bg-red-950/20'}>
                          <td className="px-3 py-2 text-sm text-foreground">{row.rowNumber}</td>
                          <td className="px-3 py-2 text-sm text-foreground">{row.title}</td>
                          <td className="px-3 py-2 text-sm text-foreground">{row.start}</td>
                          <td className="px-3 py-2 text-sm text-foreground">{row.end}</td>
                          <td className="px-3 py-2 text-sm">
                            {row.isValid ? (
                              <span className="text-green-600 dark:text-green-400">&#10003;</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400" title={row.errors.join(', ')}>
                                &#10007;
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {csvParseResult.hasErrors && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">Validation Errors</h4>
                    <ul className="text-sm text-red-800 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
                      {csvParseResult.rows
                        .filter(row => !row.isValid)
                        .map((row) => (
                          <li key={row.rowNumber}>
                            <strong>Row {row.rowNumber}:</strong> {row.errors.join(', ')}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Load into planner option */}
                {csvParseResult.validCount > 0 && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="loadIntoPlanner"
                      checked={loadIntoPlanner}
                      onChange={(e) => setLoadIntoPlanner(e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                    />
                    <label htmlFor="loadIntoPlanner" className="ml-2 text-sm text-foreground">
                      Load valid rows into planner as plan blocks
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCSVExport}
                    disabled={csvParseResult.validCount === 0}
                  >
                    Download ICS ({csvParseResult.validCount} event{csvParseResult.validCount !== 1 ? 's' : ''})
                  </Button>
                </div>
              </div>
            )}

            {!csvParseResult && !error && !isLoading && (
              <div className="mt-4 p-4 bg-muted border border-border rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">CSV Format</h4>
                <p className="text-sm text-muted-foreground mb-2">Required columns:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><code className="bg-muted-foreground/10 px-1 rounded">title</code> - Event title</li>
                  <li><code className="bg-muted-foreground/10 px-1 rounded">start</code> - Start time (ISO 8601: 2025-11-12T13:00)</li>
                  <li><code className="bg-muted-foreground/10 px-1 rounded">end</code> - End time (ISO 8601: 2025-11-12T14:00)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">Optional columns:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><code className="bg-muted-foreground/10 px-1 rounded">location</code></li>
                  <li><code className="bg-muted-foreground/10 px-1 rounded">description</code></li>
                  <li><code className="bg-muted-foreground/10 px-1 rounded">timezone</code></li>
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
