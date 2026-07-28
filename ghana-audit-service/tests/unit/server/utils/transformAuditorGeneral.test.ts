import { describe, it, expect } from 'vitest'
import { transformAuditorGeneralMessage } from '../../../../server/utils/transformAuditorGeneral'

const baseRow = {
  id: 1,
  photo: '/images/ags/johnson_akuamoah_asiedu.jpg',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

const enTranslation = {
  name: 'Johnson Akuamoah Asiedu',
  title: 'Auditor-General of Ghana',
  excerpt: 'Excerpt in English',
  fullMessage: '<p>Full message in English</p>'
}

const akTranslation = {
  name: 'Johnson Akuamoah Asiedu',
  title: 'Ghana Nsɛmhwɛfo Panyin',
  excerpt: 'Excerpt in Akan',
  fullMessage: '<p>Full message in Akan</p>'
}

describe('transformAuditorGeneralMessage', () => {
  it('returns the requested locale when a translation exists', () => {
    const result = transformAuditorGeneralMessage(
      { ...baseRow, translations: { en: enTranslation, ak: akTranslation } },
      'ak'
    )
    expect(result).toEqual({
      id: 1,
      photo: '/images/ags/johnson_akuamoah_asiedu.jpg',
      name: akTranslation.name,
      title: akTranslation.title,
      excerpt: akTranslation.excerpt,
      fullMessage: akTranslation.fullMessage
    })
  })

  it('falls back to English when the requested locale is missing', () => {
    const result = transformAuditorGeneralMessage(
      { ...baseRow, translations: { en: enTranslation } },
      'ak'
    )
    expect(result?.name).toBe(enTranslation.name)
    expect(result?.excerpt).toBe(enTranslation.excerpt)
    expect(result?.fullMessage).toBe(enTranslation.fullMessage)
  })

  it('returns null when the record is inactive', () => {
    const result = transformAuditorGeneralMessage(
      { ...baseRow, isActive: false, translations: { en: enTranslation } },
      'en'
    )
    expect(result).toBeNull()
  })

  it('returns null when no translation exists', () => {
    const result = transformAuditorGeneralMessage({ ...baseRow, translations: {} }, 'en')
    expect(result).toBeNull()
  })

  it('omits the photo when not set', () => {
    const result = transformAuditorGeneralMessage(
      { ...baseRow, photo: null, translations: { en: enTranslation } },
      'en'
    )
    expect(result?.photo).toBeUndefined()
  })
})
