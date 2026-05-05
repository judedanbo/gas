/**
 * Composable for locale-aware date formatting.
 * Uses the current i18n locale for date formatting.
 */
export function useLocaleDate() {
  const { locale } = useI18n()

  /**
   * Format a date according to the current locale.
   * @param date - Date string or Date object to format
   * @param options - Intl.DateTimeFormatOptions for customizing the format
   * @returns Formatted date string
   */
  function formatDate(
    date: string | Date,
    options?: Intl.DateTimeFormatOptions
  ): string {
    if (!date) return ''

    const d = typeof date === 'string' ? new Date(date) : date

    // Check for invalid date
    if (isNaN(d.getTime())) {
      return ''
    }

    // Map i18n locale codes to BCP 47 language tags
    const localeMap: Record<string, string> = {
      en: 'en-GB',
      ak: 'ak-GH' // Akan locale, falls back to English if not supported
    }

    const resolvedLocale = localeMap[locale.value] || 'en-GB'

    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }

    try {
      return d.toLocaleDateString(resolvedLocale, options ?? defaultOptions)
    } catch {
      // Fallback to en-GB if the locale is not supported
      return d.toLocaleDateString('en-GB', options ?? defaultOptions)
    }
  }

  /**
   * Format a date in long format (e.g., "15 December 2024")
   */
  function formatDateLong(date: string | Date): string {
    return formatDate(date, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  /**
   * Format a date in short format (e.g., "15 Dec 2024")
   */
  function formatDateShort(date: string | Date): string {
    return formatDate(date, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  /**
   * Format a date in numeric format (e.g., "15/12/2024")
   */
  function formatDateNumeric(date: string | Date): string {
    return formatDate(date, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  /**
   * Format a relative date (e.g., "2 days ago", "in 3 hours")
   */
  function formatRelativeDate(date: string | Date): string {
    if (!date) return ''

    const d = typeof date === 'string' ? new Date(date) : date

    if (isNaN(d.getTime())) {
      return ''
    }

    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // Map i18n locale to BCP 47
    const localeMap: Record<string, string> = {
      en: 'en-GB',
      ak: 'ak-GH'
    }
    const resolvedLocale = localeMap[locale.value] || 'en-GB'

    try {
      const rtf = new Intl.RelativeTimeFormat(resolvedLocale, { numeric: 'auto' })

      if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        if (diffHours === 0) {
          const diffMinutes = Math.floor(diffMs / (1000 * 60))
          return rtf.format(-diffMinutes, 'minute')
        }
        return rtf.format(-diffHours, 'hour')
      } else if (diffDays < 30) {
        return rtf.format(-diffDays, 'day')
      } else if (diffDays < 365) {
        const diffMonths = Math.floor(diffDays / 30)
        return rtf.format(-diffMonths, 'month')
      } else {
        const diffYears = Math.floor(diffDays / 365)
        return rtf.format(-diffYears, 'year')
      }
    } catch {
      // Fallback to simple format
      return formatDateShort(date)
    }
  }

  return {
    formatDate,
    formatDateLong,
    formatDateShort,
    formatDateNumeric,
    formatRelativeDate
  }
}
