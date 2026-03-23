'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Help &amp; Privacy</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Privacy Notice */}
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-2">Privacy &amp; Security</h3>
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                Your calendar never leaves your browser. All file processing happens entirely
                on your device. No data is sent to any server or stored in any database.
              </p>
            </div>
          </section>

          {/* How to Use */}
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-2">How to Use</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-primary">1.</span>
                <div>
                  <strong className="text-foreground">Import your calendar:</strong> Upload an .ics file to visualize today&apos;s
                  meetings as busy blocks. The app will parse events for the selected date.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-primary">2.</span>
                <div>
                  <strong className="text-foreground">Create plan blocks:</strong> Click anywhere on the timeline or use the
                  &quot;+ New Block&quot; button to add focused work time. Click blocks to edit them.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-primary">3.</span>
                <div>
                  <strong className="text-foreground">Manage conflicts:</strong> The app will warn you if plan blocks overlap
                  with busy time or other blocks. These are soft warnings—you can still proceed.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-primary">4.</span>
                <div>
                  <strong className="text-foreground">Export your plan:</strong> Download a separate .ics file containing only
                  your plan blocks. You can then import this into your calendar app.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-primary">5.</span>
                <div>
                  <strong className="text-foreground">CSV Import:</strong> Use the CSV → ICS utility to convert CSV data to
                  calendar format. Optionally load events directly into the planner.
                </div>
              </li>
            </ol>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-2">Keyboard Shortcuts</h3>
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Navigate between days</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded text-foreground">
                  ← →
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jump to today</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded text-foreground">
                  Today button
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Close modals</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded text-foreground">
                  Esc
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tab navigation</span>
                <kbd className="px-2 py-1 bg-background border border-border rounded text-foreground">
                  Tab / Shift+Tab
                </kbd>
              </div>
            </div>
          </section>

          {/* Technical Notes */}
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-2">Technical Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Timezone:</strong> Exported .ics files use UTC format. Your calendar app will convert to local time on import.</li>
              <li><strong className="text-foreground">Recurring events:</strong> Not supported in v0. They will be marked as ignored during import.</li>
              <li><strong className="text-foreground">Date range:</strong> Limited to today ±3 days in this version.</li>
              <li><strong className="text-foreground">Storage:</strong> Plan blocks are saved to browser localStorage and persist across sessions.</li>
            </ul>
          </section>

          {/* Support */}
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-2">Support</h3>
            <p className="text-sm text-muted-foreground">
              For issues or questions, please refer to the project repository README or
              open an issue on GitHub.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
