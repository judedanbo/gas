import type {
  AdminLanguage,
  AdminLanguages,
  AdminTranslations,
  AdminTranslationsSaved,
  AvailableLanguage
} from '~/types/admin'

type ApiError = {
  data?: { message?: string; statusMessage?: string; data?: { errors?: Record<string, string> } }
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiError
  return e?.data?.message || fallback
}

/** Per-message problems from a rejected translation save (key → reason). */
export function translationErrors(err: unknown): Record<string, string> {
  return (err as ApiError)?.data?.data?.errors ?? {}
}

/**
 * Data layer for /admin/languages: the languages the site is offered in.
 * Every change returns the full, updated list, which becomes the new state.
 */
export function useAdminLanguages() {
  const { get, post, patch, del } = useAdminApi()

  const languages = ref<AdminLanguage[]>([])
  const available = ref<AvailableLanguage[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const error = ref<string | null>(null)

  function accept(response: AdminLanguages) {
    languages.value = response.languages
    available.value = response.available
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      accept(await get<AdminLanguages>('languages'))
    } catch (err) {
      error.value = errorMessage(err, 'Failed to load languages')
    } finally {
      loading.value = false
    }
  }

  async function change(request: () => Promise<AdminLanguages>, fallback: string) {
    saving.value = true
    try {
      accept(await request())
    } catch (err) {
      throw new Error(errorMessage(err, fallback), { cause: err })
    } finally {
      saving.value = false
    }
  }

  const add = (input: { code: string; name?: string; nativeName?: string }) =>
    change(() => post<AdminLanguages>('languages', input), 'Failed to add the language')

  const update = (
    code: string,
    input: { isEnabled?: boolean; name?: string; nativeName?: string }
  ) =>
    change(() => patch<AdminLanguages>(`languages/${code}`, input), 'Failed to update the language')

  const remove = (code: string) =>
    change(() => del<AdminLanguages>(`languages/${code}`), 'Failed to remove the language')

  return { languages, available, loading, saving, error, load, add, update, remove }
}

/** Data layer for /admin/languages/[code]: one language's translations. */
export function useAdminTranslations(code: string) {
  const { get, put } = useAdminApi()

  const data = ref<AdminTranslations | null>(null)
  const loading = ref(true)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await get<AdminTranslations>(`languages/${code}/translations`)
    } catch (err) {
      error.value = errorMessage(err, 'Failed to load translations')
    } finally {
      loading.value = false
    }
  }

  /** `null` removes an entered translation. Rejects with the server's error. */
  async function save(translations: Record<string, string | null>) {
    saving.value = true
    try {
      const response = await put<AdminTranslationsSaved>(`languages/${code}/translations`, {
        translations
      })
      data.value = { language: response.language, entries: response.entries }
      return { saved: response.saved, cleared: response.cleared }
    } finally {
      saving.value = false
    }
  }

  return { data, loading, saving, error, load, save }
}
