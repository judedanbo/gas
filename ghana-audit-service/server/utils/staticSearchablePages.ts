import type { SupportedLocale } from './locale'

export interface StaticSearchablePage {
  id: string
  path: string
  title: Record<SupportedLocale, string>
  description: Record<SupportedLocale, string>
}

/**
 * Static (non-DB) pages that should appear in global search results.
 * Locale strings are inlined here rather than read from `i18n/locales/*.json`
 * to avoid filesystem reads from Nitro. Keep these in sync with the
 * corresponding page content if you change copy.
 */
export const STATIC_SEARCHABLE_PAGES: ReadonlyArray<StaticSearchablePage> = [
  {
    id: 'about',
    path: '/about',
    title: {
      en: 'About the Ghana Audit Service',
      ak: 'Ghana Nsɛm Hwɛfo Ho Nsɛm'
    },
    description: {
      en: 'Learn about the constitutional mandate, history, and role of the Ghana Audit Service in ensuring public accountability.',
      ak: 'Sua Ghana Nsɛm Hwɛfo amammui ne ne dwumadie a ɛhwɛ sɛ ɔman sika ho asɛm yɛ pɛpɛɛpɛ.'
    }
  },
  {
    id: 'the-service',
    path: '/about/the-service',
    title: { en: 'The Service', ak: 'Adwumadeɛ No' },
    description: {
      en: 'Overview of the structure, vision, and mission of the Ghana Audit Service.',
      ak: 'Ghana Nsɛm Hwɛfo nhyehyɛeɛ, anidasoɔ, ne adwumayɛ ho mpɔtam.'
    }
  },
  {
    id: 'departmental-profile',
    path: '/about/departmental-profile',
    title: { en: 'Departmental Profile', ak: 'Adwumakuo Ho Nsɛm' },
    description: {
      en: 'Profiles of the departments that make up the Ghana Audit Service.',
      ak: 'Adwumakuo a ɛyɛ Ghana Nsɛm Hwɛfo no ho nsɛm.'
    }
  },
  {
    id: 'past-auditors-general',
    path: '/about/past-auditors-general',
    title: { en: 'Past Auditors-General', ak: 'Kan Nsɛmhwɛfo Mpaninfoɔ' },
    description: {
      en: 'A historical record of the men and women who have served as Auditor-General of Ghana.',
      ak: 'Wɔn a wɔayɛ Ghana Nsɛmhwɛfo Panin no ho nsɛm.'
    }
  },
  {
    id: 'contact',
    path: '/contact',
    title: { en: 'Contact Us', ak: 'Ka Yɛn' },
    description: {
      en: 'Get in touch with the Ghana Audit Service headquarters or any of our regional offices.',
      ak: 'Bɔ yɛn amaneɛ wɔ Ghana Nsɛm Hwɛfo dwumayɛbea kɛse anaa ɔmantam adwumayɛbea biara so.'
    }
  },
  {
    id: 'citizenseye',
    path: '/citizenseye',
    title: { en: 'CitizensEye', ak: 'Ɔmanfoɔ Ani' },
    description: {
      en: 'Report concerns and engage with the Ghana Audit Service through our citizen reporting platform.',
      ak: 'Bɔ amaneɛ na yɛ adwuma ne Ghana Nsɛm Hwɛfo wɔ ɔmanfoɔ amaneɛbɔ dwumadie yi so.'
    }
  },
  {
    id: 'accessibility',
    path: '/accessibility',
    title: { en: 'Accessibility', ak: 'Nkwakwabea' },
    description: {
      en: 'Our commitment to making this website accessible to everyone, including people with disabilities.',
      ak: 'Yɛn bɔhyɛ sɛ yɛbɛyɛ wepsaet yi sɛdeɛ obiara, ne wɔn a wɔyɛ dɛm no, bɛtumi de adi dwuma.'
    }
  },
  {
    id: 'privacy-policy',
    path: '/privacy-policy',
    title: { en: 'Privacy Policy', ak: 'Kokoamsɛm Ho Nhyehyɛeɛ' },
    description: {
      en: 'How the Ghana Audit Service collects, uses, and protects personal information.',
      ak: 'Sɛnea Ghana Nsɛm Hwɛfo boaboa, di dwuma, na bɔ wo kokoamsɛm ho ban.'
    }
  },
  {
    id: 'terms',
    path: '/terms',
    title: { en: 'Terms of Use', ak: 'Adetie Mmara' },
    description: {
      en: 'The terms and conditions that govern use of the Ghana Audit Service website.',
      ak: 'Mmara a ɛhwɛ Ghana Nsɛm Hwɛfo wepsaet adetie so.'
    }
  },
  {
    id: 'publications-index',
    path: '/publications',
    title: { en: 'Publications', ak: 'Nwoma' },
    description: {
      en: 'Press statements, bulletins, guidelines, manuals, and other official publications.',
      ak: 'Asɛnka, dawubɔ, akwankyerɛ, nhyehyɛeɛ nwoma, ne nwoma foforɔ.'
    }
  },
  {
    id: 'careers-index',
    path: '/careers',
    title: { en: 'Careers', ak: 'Adwuma' },
    description: {
      en: 'Job openings, tenders, and other professional opportunities at the Ghana Audit Service.',
      ak: 'Adwumayɛbea, adetɔn, ne adwumayɛ akwan foforɔ wɔ Ghana Nsɛm Hwɛfo hɔ.'
    }
  },
  {
    id: 'reports-index',
    path: '/reports',
    title: { en: 'Audit Reports', ak: 'Nsɛmhwɛfo Amanneɛbɔ' },
    description: {
      en: 'Browse Auditor-General reports on MDAs, MMDAs, and other public entities.',
      ak: 'Hwɛ Nsɛmhwɛfo Panin amanneɛbɔ a ɛfa MDAs, MMDAs, ne ɔman dwumadie afoforɔ ho.'
    }
  },
  {
    id: 'media-index',
    path: '/media',
    title: { en: 'Media Centre', ak: 'Dawurobɔ Adwumayɛbea' },
    description: {
      en: 'News, events, photo galleries, and video content from the Ghana Audit Service.',
      ak: 'Nsɛm, dwumadie, mfonini, ne mfonini anim a ɛfiri Ghana Nsɛm Hwɛfo hɔ.'
    }
  }
]
