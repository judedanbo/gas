import type { AuditorGeneralMessage } from '~/types'

/**
 * Fallback content mirroring what was previously hardcoded in
 * components/home/AGMessage.vue. Used ONLY when the request genuinely fails
 * (e.g. the database is unreachable) so a transient outage doesn't blank the
 * section. A successful `null` response is authoritative: the record is
 * unseeded or the admin has deactivated it, so we render nothing.
 */
const FALLBACK_MESSAGE: AuditorGeneralMessage = {
  id: 0,
  photo: '/images/ags/johnson_akuamoah_asiedu.jpg',
  name: 'Johnson Akuamoah Asiedu',
  title: 'Auditor-General of Ghana',
  excerpt:
    'Our role as a public service is to audit and report on the public accounts of Ghana ' +
    'and all public offices. Our work as state auditors is vital to the sustenance of the ' +
    'economy of our nation. We therefore pledge as a Service to perform our constitutional ' +
    'mandate to help protect the public purse.',
  fullMessage:
    '<p>Our role as a public service is to audit and report on the public accounts of Ghana ' +
    'and all public offices. Our work as state auditors is vital to the sustenance of the ' +
    'economy of our nation. We therefore pledge as a Service to perform our constitutional ' +
    'mandate to help protect the public purse.</p>'
}

/**
 * Public consumer of the editable Auditor-General message singleton
 * (home page section + /about/auditor-general full-message page).
 */
export function useAuditorGeneral() {
  const { data, pending, error } = useFetch<AuditorGeneralMessage | null>('/api/auditor-general', {
    key: 'auditor-general',
    default: () => null
  })

  const message = computed<AuditorGeneralMessage | null>(() => {
    if (error.value) return FALLBACK_MESSAGE
    return data.value
  })

  return { message, pending, error }
}
