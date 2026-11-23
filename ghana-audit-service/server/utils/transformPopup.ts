import type { SitePopup } from '~/types'

interface DbPopup {
  id: number
  title: string
  imageUrl: string
  altText: string | null
  linkUrl: string | null
  openInNewTab: boolean
  displaySeconds: number
  isDismissible: boolean
}

/** Transform a database pop-up row to public API format. */
export function transformPopup(popup: DbPopup): SitePopup {
  return {
    id: popup.id,
    title: popup.title,
    imageUrl: popup.imageUrl,
    altText: popup.altText?.trim() || popup.title,
    linkUrl: popup.linkUrl || undefined,
    openInNewTab: popup.openInNewTab,
    displaySeconds: popup.displaySeconds,
    isDismissible: popup.isDismissible
  }
}
