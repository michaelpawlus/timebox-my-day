import { create } from 'zustand'
import { ToastType } from '@/components/Toast'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }))
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

// Helper functions
export function showSuccess(message: string) {
  useToastStore.getState().addToast(message, 'success')
}

export function showError(message: string) {
  useToastStore.getState().addToast(message, 'error')
}

export function showInfo(message: string) {
  useToastStore.getState().addToast(message, 'info')
}

export function showWarning(message: string) {
  useToastStore.getState().addToast(message, 'warning')
}

