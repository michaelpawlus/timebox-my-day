'use client'

import React, { useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Dropzone from './ui/Dropzone'
import { parseICSFile, readFileAsText, ParseResult } from '@/lib/ics-parse'
import { parseCSV, csvRowsToICS, CSVParseResult, ParsedCSVRow } from '@/lib/csv-parse'
import { downloadICS } from '@/lib/ics-generate'
import { useTimeBoxStore } from '@/lib/store'
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
        // Also add to planner as plan blocks
        const validRows = csvParseResult.rows.filter(row => row.isValid)
        validRows.forEach(row => {
          addPlanBlock({
            id: `csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: row.title,
            start: new Date(row.start.replace(' ', 'T')).toISOString(),
            end: new Date(row.end.replace(' ', 'T')).toISOString(),
            location: row.location,
            notes: row.description,
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Calendar" size="lg">
      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'ics'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setActiveTab('ics')}
        >
          Import ICS
        </button>
        <button
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'csv'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
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
            <div className="mt-4 text-center text-gray-600">
              Parsing calendar file...
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {parseResult && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Parse Results</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✓ Total events in file: {parseResult.totalEvents}</li>
                  <li>✓ Events for selected date: {parseResult.events.length}</li>
                  {parseResult.ignoredCount > 0 && (
                    <li>⚠ Ignored events: {parseResult.ignoredCount}</li>
                  )}
                </ul>
              </div>

              {parseResult.ignoredReasons.length > 0 && (
                <details className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <summary className="cursor-pointer font-medium text-gray-700">
                    View ignored events ({parseResult.ignoredReasons.length})
                  </summary>
                  <ul className="mt-2 text-sm text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                    {parseResult.ignoredReasons.slice(0, 20).map((reason, idx) => (
                      <li key={idx}>• {reason}</li>
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
                  variant="primary"
                  onClick={handleImport}
                  disabled={parseResult.events.length === 0}
                >
                  Import {parseResult.events.length} Event{parseResult.events.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {!parseResult && !error && !isLoading && (
            <p className="mt-4 text-sm text-gray-500 text-center">
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
            <div className="mt-4 text-center text-gray-600">
              Parsing CSV file...
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {csvParseResult && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Parse Results</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✓ Total rows: {csvParseResult.rows.length}</li>
                  <li>✓ Valid rows: {csvParseResult.validCount}</li>
                  {csvParseResult.invalidCount > 0 && (
                    <li className="text-red-700">⚠ Invalid rows: {csvParseResult.invalidCount}</li>
                  )}
                </ul>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Row</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Title</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Start</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">End</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {csvParseResult.rows.map((row) => (
                      <tr key={row.rowNumber} className={row.isValid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2 text-sm text-gray-900">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row.title}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row.start}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row.end}</td>
                        <td className="px-3 py-2 text-sm">
                          {row.isValid ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600" title={row.errors.join(', ')}>
                              ✗
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {csvParseResult.hasErrors && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Validation Errors</h4>
                  <ul className="text-sm text-red-800 space-y-1 max-h-40 overflow-y-auto">
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
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="loadIntoPlanner" className="ml-2 text-sm text-gray-700">
                    Load valid rows into planner as plan blocks
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCSVExport}
                  disabled={csvParseResult.validCount === 0}
                >
                  Download ICS ({csvParseResult.validCount} event{csvParseResult.validCount !== 1 ? 's' : ''})
                </Button>
              </div>
            </div>
          )}

          {!csvParseResult && !error && !isLoading && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">CSV Format</h4>
              <p className="text-sm text-gray-600 mb-2">Required columns:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-200 px-1 rounded">title</code> - Event title</li>
                <li><code className="bg-gray-200 px-1 rounded">start</code> - Start time (ISO 8601: 2025-11-12T13:00)</li>
                <li><code className="bg-gray-200 px-1 rounded">end</code> - End time (ISO 8601: 2025-11-12T14:00)</li>
              </ul>
              <p className="text-sm text-gray-600 mt-2">Optional columns:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-200 px-1 rounded">location</code></li>
                <li><code className="bg-gray-200 px-1 rounded">description</code></li>
                <li><code className="bg-gray-200 px-1 rounded">timezone</code></li>
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

