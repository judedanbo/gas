import type { RegionalOffice } from '~/types'

type SupportedLocale = 'en' | 'ak'

interface DbRegionalOffice {
  id: number
  slug: string
  region: string
  phone: string | null
  email: string | null
  latitude: string | null
  longitude: string | null
  displayOrder: number
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

interface RegionalOfficeWithTranslations extends DbRegionalOffice {
  translations: Record<string, { name: string; address: string }>
}

/**
 * Transform a database regional office to public API format
 */
export function transformRegionalOffice(
  office: RegionalOfficeWithTranslations,
  locale: SupportedLocale = 'en'
): RegionalOffice {
  // Get translation for requested locale, fallback to English
  const translation = office.translations[locale] ||
    office.translations.en || {
      name: 'Unknown Office',
      address: ''
    }

  // Parse coordinates
  let coordinates: { lat: number; lng: number } | undefined
  if (office.latitude && office.longitude) {
    const lat = parseFloat(office.latitude)
    const lng = parseFloat(office.longitude)
    if (!isNaN(lat) && !isNaN(lng)) {
      coordinates = { lat, lng }
    }
  }

  return {
    id: String(office.id),
    name: translation.name,
    region: office.region,
    address: translation.address,
    phone: office.phone || undefined,
    email: office.email || undefined,
    coordinates
  }
}

/**
 * Transform an array of database regional offices to public API format
 */
export function transformRegionalOffices(
  offices: RegionalOfficeWithTranslations[],
  locale: SupportedLocale = 'en'
): RegionalOffice[] {
  return offices.map((office) => transformRegionalOffice(office, locale))
}
