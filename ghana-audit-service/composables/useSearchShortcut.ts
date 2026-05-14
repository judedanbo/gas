export function useSearchShortcut() {
  const isOpen = useState('searchPalette', () => false)

  function shouldIgnore(): boolean {
    const active = document.activeElement
    if (!active) return false
    const tag = active.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if ((active as HTMLElement).isContentEditable) return true
    return false
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      if (shouldIgnore()) return
      e.preventDefault()
      isOpen.value = !isOpen.value
      return
    }

    if (e.key === 'Escape' && isOpen.value) {
      isOpen.value = false
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }

  function destroy() {
    window.removeEventListener('keydown', handleKeydown)
  }

  return { isOpen, destroy }
}
