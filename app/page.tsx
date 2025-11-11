'use client'

import DatePicker from '@/components/DatePicker'
import TimeWindowControls from '@/components/TimeWindowControls'
import Timeline from '@/components/Timeline'
import ImportModal from '@/components/ImportModal'
import PlanBlockEditor from '@/components/PlanBlockEditor'
import NewBlockButton from '@/components/NewBlockButton'
import ConflictWarning from '@/components/ConflictWarning'
import HelpModal from '@/components/HelpModal'
import { ToastContainer } from '@/components/Toast'
import Button from '@/components/ui/Button'
import { useState, useEffect } from 'react'
import { useTimeBoxStore } from '@/lib/store'
import { useToastStore, showSuccess, showError } from '@/lib/toast'
import { detectConflicts } from '@/lib/validation'
import { exportPlanBlocks } from '@/lib/ics-generate'

export default function Home() {
  const [showImportModal, setShowImportModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const { selectedBlockId, setSelectedBlockId, planBlocks, busyEvents, setConflicts, selectedDate } = useTimeBoxStore()
  const { toasts, removeToast } = useToastStore()

  // Detect conflicts whenever plan blocks or busy events change
  useEffect(() => {
    const conflicts = detectConflicts(planBlocks, busyEvents)
    setConflicts(conflicts)
  }, [planBlocks, busyEvents, setConflicts])

  const handleExport = () => {
    try {
      exportPlanBlocks(planBlocks, selectedDate)
      showSuccess(`Exported ${planBlocks.length} plan blocks successfully!`)
    } catch (error) {
      showError('Failed to export plan blocks')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Time-Box My Day
            </h1>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowImportModal(true)}
              >
                Import
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExport}
              >
                Export Plan
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelpModal(true)}
              >
                Help
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <DatePicker />
            <TimeWindowControls />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="col-span-1 space-y-4">
            <NewBlockButton />
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Quick Tips</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Click timeline to create blocks</li>
                <li>• Click blocks to edit</li>
                <li>• Import your calendar</li>
                <li>• Export your plan</li>
              </ul>
            </div>
          </div>

          {/* Timeline */}
          <div className="col-span-3 space-y-4">
            <ConflictWarning />
            <div className="bg-white rounded-lg shadow-md p-6" style={{ height: '70vh' }}>
              <Timeline />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />
      <PlanBlockEditor blockId={selectedBlockId} onClose={() => setSelectedBlockId(null)} />
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </main>
  )
}

