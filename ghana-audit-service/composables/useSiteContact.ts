/**
 * Single source of truth for the organisation's public contact details and
 * social-media links. The footer, the contact page and the Media Centre all
 * read from here so they can never disagree with each other again.
 *
 * Social links come from runtime config (`NUXT_PUBLIC_SOCIAL_*_URL`) and are
 * only rendered when a URL is configured — no more `href="#"` placeholders.
 */

export interface ContactPhone {
  display: string
  href: string
}

export interface SocialLink {
  name: string
  icon: string
  url: string
}

// TODO(content): confirm with the Audit Service which HQ address is current.
// The codebase previously showed two different addresses (contact page vs footer).
const HEADQUARTERS_ADDRESS = ['No. 12 Starlets 91 Road', 'Opposite African Union', 'Accra, Ghana']
const POSTAL_ADDRESS = ['P.O. Box MB 96', 'Accra, Ghana']
const DIGITAL_ADDRESS = 'GA-110-8787'
const PHONES: ContactPhone[] = [
  { display: '+233 (302) 664929', href: 'tel:+233302664929' },
  { display: '+233 (302) 664928', href: 'tel:+233302664928' }
]
const WORKING_HOURS = 'Monday - Friday: 8:00 AM - 5:00 PM'

export function useSiteContact() {
  const config = useRuntimeConfig().public

  const contact = {
    email: config.contactEmail as string,
    emailHref: `mailto:${config.contactEmail}`,
    phones: PHONES,
    addressLines: HEADQUARTERS_ADDRESS,
    postalLines: POSTAL_ADDRESS,
    digitalAddress: DIGITAL_ADDRESS,
    workingHours: WORKING_HOURS
  }

  const socialLinks = computed<SocialLink[]>(() =>
    [
      { name: 'Facebook', icon: 'simple-icons:facebook', url: config.socialFacebookUrl as string },
      { name: 'X (Twitter)', icon: 'simple-icons:x', url: config.socialTwitterUrl as string },
      { name: 'LinkedIn', icon: 'simple-icons:linkedin', url: config.socialLinkedinUrl as string },
      { name: 'YouTube', icon: 'simple-icons:youtube', url: config.socialYoutubeUrl as string }
    ].filter((link) => Boolean(link.url))
  )

  return { contact, socialLinks }
}
