<template>
  <footer class="bg-gray-900 text-white">
    <!-- Main Footer -->
    <div class="py-10 lg:py-16">
      <div class="container">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr] gap-10">
          <!-- About Column -->
          <div>
            <div class="flex items-center gap-3 mb-4">
              <Icon
                name="heroicons:building-library"
                class="w-8 h-8 text-accent"
                aria-hidden="true"
              />
              <div>
                <span class="block font-heading text-xl font-bold text-accent">Audit Service</span>
                <span class="text-xs text-gray-400 uppercase tracking-wide"
                  >Good Governance & Accountability</span
                >
              </div>
            </div>
            <p class="text-gray-400 leading-relaxed mb-6">
              The Audit Service has a constitutional mandate to audit all public accounts and report
              to Parliament, ensuring accountability in the use of public resources.
            </p>
            <!-- Social Media Links -->
            <div class="flex gap-3">
              <a
                href="#"
                class="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full hover:bg-primary hover:-translate-y-0.5 transition-all"
                aria-label="Facebook"
                title="Facebook"
              >
                <Icon name="simple-icons:facebook" class="w-5 h-5" aria-hidden="true" />
              </a>
              <a
                href="#"
                class="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full hover:bg-primary hover:-translate-y-0.5 transition-all"
                aria-label="Twitter"
                title="Twitter"
              >
                <Icon name="simple-icons:x" class="w-5 h-5" aria-hidden="true" />
              </a>
              <a
                href="#"
                class="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full hover:bg-primary hover:-translate-y-0.5 transition-all"
                aria-label="LinkedIn"
                title="LinkedIn"
              >
                <Icon name="simple-icons:linkedin" class="w-5 h-5" aria-hidden="true" />
              </a>
              <a
                href="#"
                class="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full hover:bg-primary hover:-translate-y-0.5 transition-all"
                aria-label="YouTube"
                title="YouTube"
              >
                <Icon name="simple-icons:youtube" class="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <!-- Quick Links Column -->
          <div>
            <h4 class="footer-heading">{{ $t('footer.quickLinks') }}</h4>
            <ul class="space-y-3">
              <li>
                <NuxtLink
                  to="/about"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('common.about') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/reports"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('common.reports') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/publications"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('common.publications') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/media/news"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('nav.news') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/careers"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('common.careers') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/contact"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('common.contact') }}</NuxtLink
                >
              </li>
            </ul>
          </div>

          <!-- Resources Column -->
          <div>
            <h4 class="footer-heading">{{ $t('footer.resources') }}</h4>
            <ul class="space-y-3">
              <li>
                <NuxtLink
                  to="/publications/press-statements"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('nav.pressStatements') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/publications/guidelines"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('nav.guidelines') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/publications/amis-manuals"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('nav.amisManuals') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/publications/pfm-strategy"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('nav.pfmStrategy') }}</NuxtLink
                >
              </li>
              <li>
                <NuxtLink
                  to="/publications/applicable-laws"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                  >{{ $t('nav.applicableLaws') }}</NuxtLink
                >
              </li>
              <li>
                <a
                  href="https://www.appsheet.com/start/5b1b9364-12e7-4613-a082-26cebb71f29f"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-400 no-underline hover:text-accent transition-colors"
                >
                  CitizensEye App
                </a>
              </li>
            </ul>
          </div>

          <!-- Contact Column -->
          <div>
            <h4 class="footer-heading">{{ $t('footer.contactUs') }}</h4>
            <div class="space-y-4">
              <div class="flex gap-3">
                <Icon
                  name="heroicons:map-pin"
                  class="w-5 h-5 flex-shrink-0 text-accent"
                  aria-hidden="true"
                />
                <div class="flex flex-col gap-1 text-sm text-gray-400">
                  <p class="m-0">Ministries Block 'O'</p>
                  <p class="m-0">1 Old Race Course Drive</p>
                  <p class="m-0">P.O. Box M96, Ministries Accra</p>
                </div>
              </div>
              <div class="flex gap-3">
                <Icon
                  name="heroicons:phone"
                  class="w-5 h-5 flex-shrink-0 text-accent"
                  aria-hidden="true"
                />
                <div class="flex flex-col gap-1 text-sm">
                  <a href="tel:+233302664929" class="text-gray-400 no-underline hover:text-accent"
                    >+233 (302) 664929</a
                  >
                  <a href="tel:+233302664920" class="text-gray-400 no-underline hover:text-accent"
                    >+233 (302) 664920</a
                  >
                  <a href="tel:+233302753600" class="text-gray-400 no-underline hover:text-accent"
                    >+233 (302) 753600</a
                  >
                </div>
              </div>
              <div class="flex gap-3">
                <Icon
                  name="heroicons:envelope"
                  class="w-5 h-5 flex-shrink-0 text-accent"
                  aria-hidden="true"
                />
                <div class="flex flex-col gap-1 text-sm">
                  <a
                    href="mailto:info@audit.gov.gh"
                    class="text-gray-400 no-underline hover:text-accent"
                    >info@audit.gov.gh</a
                  >
                </div>
              </div>
              <div class="flex gap-3">
                <Icon
                  name="heroicons:globe-alt"
                  class="w-5 h-5 flex-shrink-0 text-accent"
                  aria-hidden="true"
                />
                <div class="flex flex-col gap-1 text-sm text-gray-400">
                  <p class="m-0">Digital Address: GA-110-8787</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Newsletter Section -->
    <!-- <CommonNewsletterSubscription /> -->

    <!-- Affiliations Bar -->
    <div class="bg-black/20 py-4 border-t border-gray-800">
      <div class="container">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-4 flex-wrap">
          <span class="text-sm text-gray-500 font-medium">{{ $t('footer.affiliations') }}:</span>
          <div class="flex gap-4 flex-wrap">
            <a
              v-for="affiliation in affiliations"
              :key="affiliation.name"
              :href="affiliation.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-gray-400 no-underline px-3 py-1 bg-gray-800 rounded-md hover:bg-primary hover:text-white transition-all"
              :title="affiliation.fullName"
            >
              {{ affiliation.name }}
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Related Links Bar -->
    <div class="bg-black/10 py-4 border-t border-gray-800">
      <div class="container">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-4 flex-wrap">
          <span class="text-sm text-gray-500 font-medium">{{ $t('footer.relatedLinks') }}:</span>
          <div class="flex gap-4 flex-wrap">
            <a
              v-for="link in relatedLinks"
              :key="link.name"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-gray-400 no-underline px-3 py-1 bg-gray-800 rounded-md hover:bg-primary hover:text-white transition-all"
            >
              {{ link.name }}
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="bg-black/30 py-4 border-t border-gray-800">
      <div class="container">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4">
          <p class="text-sm text-gray-500 m-0">
            &copy; {{ currentYear }} Audit Service. {{ $t('footer.copyright') }}
          </p>
          <div class="flex gap-6">
            <NuxtLink
              to="/privacy-policy"
              class="text-sm text-gray-500 no-underline hover:text-accent transition-colors"
              >{{ $t('footer.privacyPolicy') }}</NuxtLink
            >
            <NuxtLink
              to="/terms"
              class="text-sm text-gray-500 no-underline hover:text-accent transition-colors"
              >{{ $t('footer.termsOfUse') }}</NuxtLink
            >
            <NuxtLink
              to="/accessibility"
              class="text-sm text-gray-500 no-underline hover:text-accent transition-colors"
              >{{ $t('footer.accessibility') }}</NuxtLink
            >
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
  const currentYear = new Date().getFullYear()

  const affiliations = [
    {
      name: 'AFROSAI-E',
      fullName: 'African Organisation of Supreme Audit Institutions',
      url: 'https://afrosai-e.org.za/'
    },
    {
      name: 'INTOSAI',
      fullName: 'International Organization of Supreme Audit Institutions',
      url: 'https://www.intosai.org/'
    },
    {
      name: 'ISSAI',
      fullName: 'International Standards of Supreme Audit Institutions',
      url: 'https://www.issai.org/'
    },
    { name: 'INTOSAI-IDI', fullName: 'INTOSAI Development Initiative', url: 'https://www.idi.no/' }
  ]

  const relatedLinks = [
    { name: 'Parliament of Ghana', url: 'https://www.parliament.gh/' },
    { name: 'Ministry of Finance', url: 'https://www.mofep.gov.gh/' },
    { name: 'Public Services Commission', url: 'https://www.psc.gov.gh/' },
    { name: "Controller & Accountant General's Dept", url: 'https://www.cagd.gov.gh/' }
  ]
</script>

<!-- Styles moved to global tailwind.css as .footer-heading component class -->
