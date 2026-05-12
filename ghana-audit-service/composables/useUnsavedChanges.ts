export function useUnsavedChanges(formData: () => Record<string, unknown>) {
  const savedSnapshot = ref<string>('')
  const forcedClean = ref(false)

  const hasChanges = computed(() => {
    if (forcedClean.value) return false
    if (!savedSnapshot.value) return false
    return JSON.stringify(formData()) !== savedSnapshot.value
  })

  function markSaved() {
    savedSnapshot.value = JSON.stringify(formData())
    forcedClean.value = false
  }

  function markClean() {
    forcedClean.value = true
  }

  // Browser close/refresh warning
  if (import.meta.client) {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges.value) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    onBeforeUnmount(() => {
      window.removeEventListener('beforeunload', handler)
    })
  }

  // Vue Router navigation guard
  onBeforeRouteLeave(() => {
    if (hasChanges.value) {
      const answer = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      )
      if (!answer) return false
    }
  })

  return { hasChanges, markSaved, markClean }
}
