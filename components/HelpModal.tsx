'use client'

import React from 'react'
import Modal from './ui/Modal'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Help & Privacy" size="lg">
      <div className="space-y-6">
        {/* Privacy Notice */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Privacy & Security</h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              🔒 Your calendar never leaves your browser. All file processing happens entirely
              on your device. No data is sent to any server or stored in any database.
            </p>
          </div>
        </section>

        {/* How to Use */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">How to Use</h3>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="font-semibold text-blue-600">1.</span>
              <div>
                <strong>Import your calendar:</strong> Upload an .ics file to visualize today's
                meetings as busy blocks. The app will parse events for the selected date.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-blue-600">2.</span>
              <div>
                <strong>Create plan blocks:</strong> Click anywhere on the timeline or use the
                "+ New Block" button to add focused work time. Click blocks to edit them.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-blue-600">3.</span>
              <div>
                <strong>Manage conflicts:</strong> The app will warn you if plan blocks overlap
                with busy time or other blocks. These are soft warnings—you can still proceed.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-blue-600">4.</span>
              <div>
                <strong>Export your plan:</strong> Download a separate .ics file containing only
                your plan blocks. You can then import this into your calendar app.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-blue-600">5.</span>
              <div>
                <strong>CSV Import:</strong> Use the CSV → ICS utility to convert CSV data to
                calendar format. Optionally load events directly into the planner.
              </div>
            </li>
          </ol>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Keyboard Shortcuts</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Navigate between days</span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-800">
                ← →
              </kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Jump to today</span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-800">
                Today button
              </kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Close modals</span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-800">
                Esc
              </kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Tab navigation</span>
              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-gray-800">
                Tab / Shift+Tab
              </kbd>
            </div>
          </div>
        </section>

        {/* Technical Notes */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Technical Notes</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• <strong>Timezone:</strong> Exported .ics files use UTC format. Your calendar app will convert to local time on import.</li>
            <li>• <strong>Recurring events:</strong> Not supported in v0. They will be marked as ignored during import.</li>
            <li>• <strong>Date range:</strong> Limited to today ±3 days in this version.</li>
            <li>• <strong>Storage:</strong> Plan blocks are saved to browser localStorage and persist across sessions.</li>
          </ul>
        </section>

        {/* Support */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Support</h3>
          <p className="text-sm text-gray-700">
            For issues or questions, please refer to the project repository README or
            open an issue on GitHub.
          </p>
        </section>
      </div>
    </Modal>
  )
}

