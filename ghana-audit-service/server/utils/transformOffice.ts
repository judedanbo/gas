import type { Office } from '~/types'

type SupportedLocale = 'en' | 'ak'

interface DbOffice {
  id: number
  slug: string
  typeId: number
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

interface OfficeWithTranslations extends DbOffice {
  typeName?: string
  translations: Record<string, { name: string; address: string }>
}

export function transformOffice(
  office: OfficeWithTranslations,
  locale: SupportedLocale = 'en'
): Office {
  const translation = office.translations[locale] ||
    office.translations.en || {
      name: 'Unknown Office',
      address: ''
    }

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
    type: office.typeName || '',
    region: office.region,
    address: translation.address,
    phone: office.phone || undefined,
    email: office.email || undefined,
    coordinates
  }
}

export function transformOffices(
  offices: OfficeWithTranslations[],
  locale: SupportedLocale = 'en'
): Office[] {
  return offices.map((office) => transformOffice(office, locale))
}
