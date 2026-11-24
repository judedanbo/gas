/**
 * The apps the site starts with. Migration 0013_service_apps inserts exactly
 * this content (tests/unit/server/utils/serviceApps.test.ts checks the two stay
 * in step); after that the apps are edited at /admin/apps, not here.
 *
 * CitizensEye's text is the landing page that used to be hard-coded in
 * pages/citizenseye/index.vue. The Tracker's is a first draft written from the
 * 2026-2030 Strategic Plan's description of the E-Tracker — review it in the
 * admin panel.
 */
import type { AppContent, AppTranslation } from '../../../../utils/serviceApps'

export interface SeedServiceApp {
  slug: string
  url: string
  icon: string
  privacyUrl: string | null
  sortOrder: number
  en: AppTranslation
}

const citizensEyeContent: AppContent = {
  features: {
    title: '',
    intro: 'Our platform provides powerful tools for citizen engagement and public accountability.',
    items: [
      {
        icon: 'heroicons:pencil-square',
        title: 'Report Irregularities',
        description:
          'Submit detailed reports about financial misconduct, fraud, or misuse of public funds you have witnessed or are aware of.'
      },
      {
        icon: 'heroicons:chart-bar',
        title: 'Track Your Reports',
        description:
          'Monitor the status of your submissions and receive updates as they are reviewed and acted upon.'
      },
      {
        icon: 'heroicons:lock-closed',
        title: 'Anonymous Reporting',
        description:
          'Choose to remain anonymous when submitting sensitive reports. Your identity is protected.'
      },
      {
        icon: 'heroicons:paper-clip',
        title: 'Upload Evidence',
        description:
          'Attach documents, photos, or other evidence to support your report and help investigators.'
      },
      {
        icon: 'heroicons:map-pin',
        title: 'Location Tagging',
        description:
          'Tag the location of incidents to help auditors identify and investigate specific areas.'
      },
      {
        icon: 'heroicons:bell',
        title: 'Real-time Updates',
        description:
          'Receive notifications about the progress of your report and any actions taken.'
      }
    ]
  },
  steps: {
    title: '',
    intro: 'Submitting a report is simple and secure. Follow these three easy steps.',
    items: [
      {
        icon: 'heroicons:device-phone-mobile',
        title: 'Access the App',
        description:
          'Click the "Launch CitizensEye App" button to open the platform in your browser. No download required.'
      },
      {
        icon: 'heroicons:pencil',
        title: 'Submit Your Report',
        description:
          'Fill out the report form with details about the irregularity. Add evidence and location if available.'
      },
      {
        icon: 'heroicons:eye',
        title: 'Track Progress',
        description:
          'Use your report reference number to track the status of your submission and any actions taken.'
      }
    ]
  },
  audiences: {
    title: '',
    intro: 'Our platform benefits both citizens and government in promoting accountability.',
    items: [
      {
        icon: 'heroicons:user-group',
        title: 'For Citizens',
        points: [
          'Safe and secure platform for reporting concerns',
          'Option to remain anonymous for sensitive reports',
          'Easy-to-use interface accessible from any device',
          'Track the progress of your submissions',
          'Contribute to national accountability efforts',
          'Make your voice heard in protecting public resources'
        ]
      },
      {
        icon: 'heroicons:building-library',
        title: 'For Government',
        points: [
          'Direct channel for citizen feedback and reports',
          'Early detection of financial irregularities',
          'Evidence-based audit planning and prioritization',
          'Enhanced public trust through transparency',
          'Improved accountability in public institutions',
          'Support for anti-corruption initiatives'
        ]
      }
    ]
  },
  highlights: {
    title: 'What Can You Report?',
    intro: 'CitizensEye accepts reports on various financial and administrative irregularities.',
    items: [
      { icon: 'heroicons:currency-dollar', title: 'Financial Fraud' },
      { icon: 'heroicons:clipboard-document-list', title: 'Procurement Irregularities' },
      { icon: 'heroicons:user', title: 'Ghost Workers' },
      { icon: 'heroicons:building-office', title: 'Abandoned Projects' },
      { icon: 'heroicons:chart-bar', title: 'Misuse of Public Funds' },
      { icon: 'heroicons:pencil-square', title: 'Contract Violations' },
      { icon: 'heroicons:user-group', title: 'Conflict of Interest' },
      { icon: 'heroicons:exclamation-triangle', title: 'Other Irregularities' }
    ]
  },
  faqs: {
    title: '',
    intro: 'Find answers to common questions about CitizensEye.',
    items: [
      {
        question: 'What is CitizensEye?',
        answer:
          'CitizensEye is a citizen engagement platform developed by the Ghana Audit Service that allows members of the public to report financial irregularities, fraud, and misuse of public funds. It serves as a direct channel for citizens to contribute to public accountability efforts in Ghana.'
      },
      {
        question: 'How do I submit a report?',
        answer:
          'To submit a report, click the "Launch CitizensEye App" button, which will open the platform in your browser. Follow the on-screen instructions to fill out the report form with details about the irregularity you wish to report. You can attach evidence and tag locations to support your submission.'
      },
      {
        question: 'Is my identity protected?',
        answer:
          'Yes, CitizensEye offers anonymous reporting options. You can choose not to provide your personal information when submitting a report. Even if you do provide contact details, your identity is kept confidential and protected in accordance with our privacy policy.'
      },
      {
        question: 'What happens after I submit a report?',
        answer:
          "After submission, your report is reviewed by our team and assigned to the appropriate audit unit for investigation. You will receive a reference number to track your report's progress. Depending on the nature of the report, it may be included in scheduled audits or trigger a special investigation."
      },
      {
        question: 'What types of issues can I report?',
        answer:
          'You can report various financial and administrative irregularities including: financial fraud, procurement irregularities, ghost workers, abandoned projects, misuse of public funds, contract violations, conflicts of interest, and other concerns affecting public accountability.'
      },
      {
        question: 'How do I track my report?',
        answer:
          'When you submit a report, you receive a unique reference number. You can use this number in the CitizensEye app to check the status of your report, view any updates, and see what actions have been taken. If you provided contact information, you may also receive email or SMS updates.'
      }
    ]
  }
}

const trackerContent: AppContent = {
  features: {
    title: '',
    intro:
      'The Tracker connects audit findings with the action taken on them, so progress is visible to everyone.',
    items: [
      {
        icon: 'heroicons:document-magnifying-glass',
        title: 'Find Recommendations',
        description:
          "Look up the findings and recommendations from the Auditor-General's audit reports."
      },
      {
        icon: 'heroicons:arrow-path',
        title: 'Follow Up on Action',
        description:
          'See the follow-up recorded on each recommendation and whether it has been acted on.'
      },
      {
        icon: 'heroicons:building-library',
        title: 'Hold Institutions to Account',
        description:
          "Help Parliament's Public Accounts Committee and citizens check that audited entities implement recommendations."
      },
      {
        icon: 'heroicons:globe-alt',
        title: 'Open to the Public',
        description: 'Use the Tracker from any device with a web browser.'
      }
    ]
  },
  steps: {
    title: '',
    intro: '',
    items: [
      {
        icon: 'heroicons:computer-desktop',
        title: 'Open the Tracker',
        description: 'Select "Open the Tracker" to go to tracker.audit.gov.gh in a new tab.'
      },
      {
        icon: 'heroicons:magnifying-glass',
        title: 'Find a Recommendation',
        description:
          'Search or browse for the institution, report or recommendation you are interested in.'
      },
      {
        icon: 'heroicons:clipboard-document-check',
        title: 'Check Its Progress',
        description: 'See the follow-up recorded for the recommendation.'
      }
    ]
  },
  audiences: { title: '', intro: '', items: [] },
  highlights: { title: '', intro: '', items: [] },
  faqs: {
    title: '',
    intro: '',
    items: [
      {
        question: 'What is the Audit Recommendations Tracker?',
        answer:
          'The Audit Recommendations Tracker (E-Tracker) is a Ghana Audit Service platform that publishes audit findings and recommendations and follows up on how audited entities implement them.'
      },
      {
        question: 'Who can use the Tracker?',
        answer:
          "The Tracker is open to the public. It also supports Parliament's Public Accounts Committee in following up audit recommendations."
      },
      {
        question: 'Where do the recommendations come from?',
        answer:
          'They come from the audits carried out by the Ghana Audit Service and reported by the Auditor-General.'
      }
    ]
  }
}

export const SEED_SERVICE_APPS: readonly SeedServiceApp[] = [
  {
    slug: 'citizenseye',
    url: 'https://www.appsheet.com/start/5b1b9364-12e7-4613-a082-26cebb71f29f',
    icon: 'heroicons:eye',
    privacyUrl: '/citizenseye/privacy',
    sortOrder: 1,
    en: {
      name: 'CitizensEye',
      tagline: 'Citizen Engagement Platform for Public Accountability',
      summary:
        'Report concerns and engage with the Ghana Audit Service through our citizen engagement platform.',
      headline: 'Be Part of the Fight Against Financial Irregularities',
      body:
        "<p>CitizensEye is the Ghana Audit Service's citizen engagement platform that empowers you to report financial irregularities, mismanagement of public funds, and other concerns affecting public accountability.</p>" +
        "<p>Your voice matters in protecting Ghana's public resources. With CitizensEye, you can securely submit reports, upload evidence, and track the progress of your submissions - all while maintaining your anonymity if you choose.</p>",
      launchLabel: 'Launch CitizensEye App',
      imageAlt: '',
      ctaTitle: 'Ready to Make a Difference?',
      ctaText:
        'Join thousands of Ghanaians who are helping to protect public resources. Your report could make a real difference.',
      content: citizensEyeContent
    }
  },
  {
    slug: 'tracker',
    url: 'https://tracker.audit.gov.gh',
    icon: 'heroicons:clipboard-document-check',
    privacyUrl: null,
    sortOrder: 2,
    en: {
      name: 'Audit Recommendations Tracker',
      tagline: 'Follow the action taken on audit recommendations',
      summary:
        "See the Auditor-General's audit recommendations and follow how public institutions are acting on them.",
      headline: 'From Audit Findings to Action',
      body:
        "<p>The Audit Recommendations Tracker (E-Tracker) brings together the findings and recommendations from the Auditor-General's audit reports and the follow-up action taken by audited entities.</p>" +
        '<p>It helps Parliament, the public and the Ghana Audit Service see whether recommendations are being implemented, as set out in our 2026-2030 Strategic Plan.</p>',
      launchLabel: 'Open the Tracker',
      imageAlt: '',
      ctaTitle: 'Follow Audit Recommendations',
      ctaText: "See how public institutions are acting on the Auditor-General's recommendations.",
      content: trackerContent
    }
  }
]

/** SQL that inserts SEED_SERVICE_APPS — what migration 0013 ends with. */
export function seedServiceAppsSql(): string {
  const quote = (value: string | null) =>
    value === null ? 'NULL' : `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
  const blank = (value: string) => (value.trim() ? quote(value) : 'NULL')
  const statements: string[] = []
  for (const app of SEED_SERVICE_APPS) {
    statements.push(
      'INSERT INTO `service_apps` (`slug`, `url`, `icon`, `privacy_url`, `sort_order`, `is_active`) VALUES (' +
        [
          quote(app.slug),
          quote(app.url),
          quote(app.icon),
          quote(app.privacyUrl),
          app.sortOrder,
          'true'
        ].join(', ') +
        ');'
    )
    const t = app.en
    statements.push(
      'INSERT INTO `service_app_translations` (`app_id`, `locale`, `name`, `tagline`, `summary`, `headline`, `body`, `launch_label`, `image_alt`, `cta_title`, `cta_text`, `content`) SELECT `id`, ' +
        [
          "'en'",
          quote(t.name),
          blank(t.tagline),
          quote(t.summary),
          blank(t.headline),
          blank(t.body),
          blank(t.launchLabel),
          blank(t.imageAlt),
          blank(t.ctaTitle),
          blank(t.ctaText),
          quote(JSON.stringify(t.content))
        ].join(', ') +
        ` FROM \`service_apps\` WHERE \`slug\` = ${quote(app.slug)};`
    )
  }
  return statements.join('--> statement-breakpoint\n')
}
