export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration: number
}

// Module-level state for singleton behavior
const toasts = ref<Toast[]>([])

let counter = 0

function addToast(type: Toast['type'], message: string, duration = 4000) {
  const id = `toast-${++counter}-${Date.now()}`
  toasts.value.push({ id, type, message, duration })

  setTimeout(() => {
    dismiss(id)
  }, duration)
}

function dismiss(id: string) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useToast() {
  return {
    toasts,
    success: (message: string, duration?: number) => addToast('success', message, duration),
    error: (message: string, duration?: number) => addToast('error', message, duration),
    warning: (message: string, duration?: number) => addToast('warning', message, duration),
    info: (message: string, duration?: number) => addToast('info', message, duration),
    dismiss,
  }
}
