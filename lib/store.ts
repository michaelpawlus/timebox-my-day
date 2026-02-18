import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BusyEvent, PlanBlock, Conflict, UnscheduledBlock } from './types'

interface TimeBoxStore {
  // Date and time window
  selectedDate: Date
  startHour: number
  endHour: number
  setSelectedDate: (date: Date) => void
  setTimeWindow: (start: number, end: number) => void

  // Busy events (from ICS)
  busyEvents: BusyEvent[]
  setBusyEvents: (events: BusyEvent[]) => void
  clearBusyEvents: () => void

  // Plan blocks
  planBlocks: PlanBlock[]
  addPlanBlock: (block: PlanBlock) => void
  updatePlanBlock: (id: string, updates: Partial<PlanBlock>) => void
  deletePlanBlock: (id: string) => void
  clearPlanBlocks: () => void

  // Unscheduled blocks (holding area)
  unscheduledBlocks: UnscheduledBlock[]
  addUnscheduledBlock: (block: UnscheduledBlock) => void
  removeUnscheduledBlock: (id: string) => void
  clearUnscheduledBlocks: () => void

  // Conflicts
  conflicts: Conflict[]
  setConflicts: (conflicts: Conflict[]) => void

  // UI state
  selectedBlockId: string | null
  setSelectedBlockId: (id: string | null) => void

  // Drag state (for existing timeline blocks)
  isDragging: boolean
  draggedBlockId: string | null
  dragMode: 'move' | 'resize-top' | 'resize-bottom' | null
  dragOriginalStart: string | null
  dragOriginalEnd: string | null
  startDrag: (blockId: string, mode: 'move' | 'resize-top' | 'resize-bottom', start: string, end: string) => void
  endDrag: () => void

  // Holding area drag state
  holdingDragBlockId: string | null
  startHoldingDrag: (id: string) => void
  endHoldingDrag: () => void
}

export const useTimeBoxStore = create<TimeBoxStore>()(
  persist(
    (set) => ({
      // Initial state
      selectedDate: new Date(),
      startHour: 8,
      endHour: 18,
      busyEvents: [],
      planBlocks: [],
      unscheduledBlocks: [],
      conflicts: [],
      selectedBlockId: null,
      isDragging: false,
      draggedBlockId: null,
      dragMode: null,
      dragOriginalStart: null,
      dragOriginalEnd: null,
      holdingDragBlockId: null,

      // Actions
      setSelectedDate: (date) => set({ selectedDate: date }),
      setTimeWindow: (start, end) => set({ startHour: start, endHour: end }),

      setBusyEvents: (events) => set({ busyEvents: events }),
      clearBusyEvents: () => set({ busyEvents: [] }),

      addPlanBlock: (block) =>
        set((state) => ({ planBlocks: [...state.planBlocks, block] })),

      updatePlanBlock: (id, updates) =>
        set((state) => ({
          planBlocks: state.planBlocks.map((block) =>
            block.id === id ? { ...block, ...updates } : block
          ),
        })),

      deletePlanBlock: (id) =>
        set((state) => ({
          planBlocks: state.planBlocks.filter((block) => block.id !== id),
        })),

      clearPlanBlocks: () => set({ planBlocks: [] }),

      // Unscheduled blocks
      addUnscheduledBlock: (block) =>
        set((state) => ({ unscheduledBlocks: [...state.unscheduledBlocks, block] })),

      removeUnscheduledBlock: (id) =>
        set((state) => ({
          unscheduledBlocks: state.unscheduledBlocks.filter((b) => b.id !== id),
        })),

      clearUnscheduledBlocks: () => set({ unscheduledBlocks: [] }),

      setConflicts: (conflicts) => set({ conflicts }),
      setSelectedBlockId: (id) => set({ selectedBlockId: id }),

      startDrag: (blockId, mode, start, end) =>
        set({
          isDragging: true,
          draggedBlockId: blockId,
          dragMode: mode,
          dragOriginalStart: start,
          dragOriginalEnd: end,
        }),

      endDrag: () =>
        set({
          isDragging: false,
          draggedBlockId: null,
          dragMode: null,
          dragOriginalStart: null,
          dragOriginalEnd: null,
        }),

      // Holding area drag
      startHoldingDrag: (id) => set({ holdingDragBlockId: id }),
      endHoldingDrag: () => set({ holdingDragBlockId: null }),
    }),
    {
      name: 'timebox-storage',
      version: 2,
      partialize: (state) => ({
        planBlocks: state.planBlocks,
        unscheduledBlocks: state.unscheduledBlocks,
        startHour: state.startHour,
        endHour: state.endHour,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>
        if (version < 2) {
          // Assign default color to existing plan blocks missing it
          const blocks = (state.planBlocks as PlanBlock[]) || []
          state.planBlocks = blocks.map((b) => ({
            ...b,
            color: b.color || '#3b82f6',
          }))
          state.unscheduledBlocks = state.unscheduledBlocks || []
        }
        return state as unknown as TimeBoxStore
      },
    }
  )
)
