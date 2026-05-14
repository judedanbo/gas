<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb :crumbs="[{ label: 'Contact', path: '/contact' }]" />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Contact Us</h1>
        <p class="page-subtitle">Get in touch with the Ghana Audit Service. We're here to help.</p>
      </div>
    </div>

    <!-- Contact Information & Form -->
    <section class="section bg-white dark:bg-gray-800">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <!-- Contact Information -->
          <div>
            <h2 class="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">
              Get In Touch
            </h2>
            <p class="text-gray-600 dark:text-gray-400 mb-8">
              Have questions about our services or need to submit a report? Contact us through any
              of the channels below.
            </p>

            <div class="space-y-6">
              <!-- Phone -->
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0"
                >
                  <Icon name="heroicons:phone" class="w-6 h-6 text-primary dark:text-primary-light" aria-hidden="true" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">Phone</h3>
                  <p class="text-gray-600 dark:text-gray-400">+233 (302) 664929</p>
                  <p class="text-gray-600 dark:text-gray-400">+233 (302) 664928</p>
                </div>
              </div>

              <!-- Email -->
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0"
                >
                  <Icon name="heroicons:envelope" class="w-6 h-6 text-primary dark:text-primary-light" aria-hidden="true" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">Email</h3>
                  <a
                    href="mailto:info@audit.gov.gh"
                    class="text-primary dark:text-primary-light hover:text-primary-dark dark:hover:text-primary"
                    >info@audit.gov.gh</a
                  >
                </div>
              </div>

              <!-- Physical Address -->
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0"
                >
                  <Icon name="heroicons:map-pin" class="w-6 h-6 text-primary dark:text-primary-light" aria-hidden="true" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">Physical Address</h3>
                  <p class="text-gray-600 dark:text-gray-400">
                    No. 12 Starlets 91 Road<br />
                    Opposite African Union<br />
                    Accra, Ghana
                  </p>
                </div>
              </div>

              <!-- Postal Address -->
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0"
                >
                  <Icon name="heroicons:envelope" class="w-6 h-6 text-primary dark:text-primary-light" aria-hidden="true" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">Postal Address</h3>
                  <p class="text-gray-600 dark:text-gray-400">
                    P.O. Box MB 96<br />
                    Accra, Ghana
                  </p>
                </div>
              </div>

              <!-- Working Hours -->
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0"
                >
                  <Icon name="heroicons:clock" class="w-6 h-6 text-primary dark:text-primary-light" aria-hidden="true" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-1">Working Hours</h3>
                  <p class="text-gray-600 dark:text-gray-400">Monday - Friday: 8:00 AM - 5:00 PM</p>
                  <p class="text-gray-500 dark:text-gray-400 text-sm">
                    Closed on weekends and public holidays
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Contact Form -->
          <div id="send-message">
            <div
              class="bg-gray-50 dark:bg-gray-900 rounded-xl p-8 border border-gray-200 dark:border-gray-700"
            >
              <h2 class="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">
                Send Us a Message
              </h2>

              <form class="space-y-6" @submit.prevent="submitForm">
                <!-- Name -->
                <div>
                  <label
                    for="name"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Full Name <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    v-model="form.name"
                    type="text"
                    required
                    class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    :class="{ 'border-red-500': errors.name }"
                    placeholder="Enter your full name"
                  />
                  <p v-if="errors.name" class="text-red-500 text-sm mt-1">{{ errors.name }}</p>
                </div>

                <!-- Email -->
                <div>
                  <label
                    for="email"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Email Address <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    v-model="form.email"
                    type="email"
                    required
                    class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    :class="{ 'border-red-500': errors.email }"
                    placeholder="Enter your email"
                  />
                  <p v-if="errors.email" class="text-red-500 text-sm mt-1">{{ errors.email }}</p>
                </div>

                <!-- Phone -->
                <div>
                  <label
                    for="phone"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    v-model="form.phone"
                    type="tel"
                    class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Enter your phone number (optional)"
                  />
                </div>

                <!-- Subject -->
                <div>
                  <label
                    for="subject"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Subject <span class="text-red-500">*</span>
                  </label>
                  <select
                    id="subject"
                    v-model="form.subject"
                    required
                    class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    :class="{ 'border-red-500': errors.subject }"
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="report">Report a Concern</option>
                    <option value="audit">Audit Related</option>
                    <option value="procurement">Procurement/Tenders</option>
                    <option value="careers">Careers</option>
                    <option value="media">Media/Press</option>
                    <option value="other">Other</option>
                  </select>
                  <p v-if="errors.subject" class="text-red-500 text-sm mt-1">
                    {{ errors.subject }}
                  </p>
                </div>

                <!-- Message -->
                <div>
                  <label
                    for="message"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Message <span class="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    v-model="form.message"
                    required
                    rows="5"
                    class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    :class="{ 'border-red-500': errors.message }"
                    placeholder="Enter your message"
                  ></textarea>
                  <p v-if="errors.message" class="text-red-500 text-sm mt-1">
                    {{ errors.message }}
                  </p>
                </div>

                <!-- Submit Button -->
                <button
                  type="submit"
                  :disabled="isSubmitting"
                  class="btn-primary w-full justify-center"
                  :class="{ 'opacity-50 cursor-not-allowed': isSubmitting }"
                >
                  <span v-if="isSubmitting">Sending...</span>
                  <span v-else>Send Message</span>
                </button>

                <!-- Success Message -->
                <div
                  v-if="submitSuccess"
                  class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-800 dark:text-green-300"
                >
                  Thank you for your message! We will get back to you within 2-3 business days.
                </div>

                <!-- Error Message -->
                <div
                  v-if="submitError"
                  class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-300"
                >
                  {{ submitError }}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Offices by Region -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <UiSectionHeader
          title="Our Offices Nationwide"
          description="Find a Ghana Audit Service office near you"
        />

        <div class="space-y-8">
          <div
            v-for="group in groupedOffices"
            :key="group.region"
            class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <!-- Region Header with Regional Office -->
            <div class="bg-primary/5 dark:bg-primary/10 border-b border-gray-200 dark:border-gray-700">
              <button
                class="w-full flex items-center justify-between p-5 text-left"
                :aria-expanded="isRegionExpanded(group.region)"
                @click="toggleRegion(group.region)"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Icon name="heroicons:map-pin" class="w-5 h-5 text-primary dark:text-primary-light" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 class="text-lg font-heading font-bold text-gray-900 dark:text-white">
                      {{ group.region }} Region
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ group.districtOffices.length + (group.regionalOffice ? 1 : 0) }}
                      {{ group.districtOffices.length + (group.regionalOffice ? 1 : 0) === 1 ? 'office' : 'offices' }}
                    </p>
                  </div>
                </div>
                <svg
                  class="w-5 h-5 text-gray-500 transition-transform duration-200"
                  :class="{ 'rotate-180': isRegionExpanded(group.region) }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Regional Office (always visible as the prominent card) -->
              <div v-if="group.regionalOffice" class="px-5 pb-5">
                <div class="bg-white dark:bg-gray-900 rounded-lg border-2 border-primary/30 dark:border-primary/40 p-5 shadow-sm">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                          Regional Office
                        </span>
                      </div>
                      <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-3">
                        {{ group.regionalOffice.name }}
                      </h4>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <p class="flex items-start gap-2">
                          <Icon name="heroicons:map-pin" class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                          <span>{{ group.regionalOffice.address }}</span>
                        </p>
                        <div class="space-y-2">
                          <p v-if="group.regionalOffice.phone" class="flex items-center gap-2">
                            <Icon name="heroicons:phone" class="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                            <span>{{ group.regionalOffice.phone }}</span>
                          </p>
                          <p v-if="group.regionalOffice.email" class="flex items-center gap-2">
                            <Icon name="heroicons:envelope" class="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                            <a
                              :href="`mailto:${group.regionalOffice.email}`"
                              class="text-primary dark:text-primary-light hover:text-primary-dark dark:hover:text-primary"
                            >{{ group.regionalOffice.email }}</a>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- District Offices (collapsible) -->
            <div
              v-if="group.districtOffices.length > 0"
              v-show="isRegionExpanded(group.region)"
              class="p-5"
            >
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                District Offices
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="office in group.districtOffices"
                  :key="office.id"
                  class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/50 transition-colors"
                >
                  <h5 class="font-medium text-gray-900 dark:text-white text-sm mb-2">
                    {{ office.name }}
                  </h5>
                  <div class="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <p class="flex items-start gap-1.5">
                      <Icon name="heroicons:map-pin" class="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{{ office.address }}</span>
                    </p>
                    <p v-if="office.phone" class="flex items-center gap-1.5">
                      <Icon name="heroicons:phone" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                      <span>{{ office.phone }}</span>
                    </p>
                    <p v-if="office.email" class="flex items-center gap-1.5">
                      <Icon name="heroicons:envelope" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                      <a
                        :href="`mailto:${office.email}`"
                        class="text-primary dark:text-primary-light hover:text-primary-dark dark:hover:text-primary"
                      >{{ office.email }}</a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Expand prompt when collapsed and has district offices -->
            <div
              v-if="group.districtOffices.length > 0"
              v-show="!isRegionExpanded(group.region)"
              class="px-5 py-3 border-t border-gray-100 dark:border-gray-700/50"
            >
              <button
                class="text-sm text-primary dark:text-primary-light hover:underline"
                @click="toggleRegion(group.region)"
              >
                View {{ group.districtOffices.length }} district
                {{ group.districtOffices.length === 1 ? 'office' : 'offices' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="section bg-white dark:bg-gray-800">
      <div class="container">
        <UiSectionHeader
          title="Frequently Asked Questions"
          description="Find answers to common questions about the Ghana Audit Service"
        />

        <div class="max-w-3xl mx-auto space-y-4">
          <UiAccordionItem
            v-for="(faq, index) in faqs"
            :key="index"
            :title="faq.question"
            :icon="faq.icon"
            variant="card"
          >
            <p class="text-gray-600 dark:text-gray-400">{{ faq.answer }}</p>
          </UiAccordionItem>
        </div>
      </div>
    </section>

    <!-- Quick Links -->
    <section class="section-sm bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <div class="flex flex-wrap justify-center gap-4">
          <NuxtLink to="/about" class="btn-outline"> About Us </NuxtLink>
          <NuxtLink to="/reports" class="btn-outline"> View Reports </NuxtLink>
          <NuxtLink to="/careers" class="btn-outline"> Career Opportunities </NuxtLink>
          <NuxtLink to="/careers/tenders" class="btn-outline"> Tenders & Procurement </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { Office, ContactFormData } from '~/types'

  // SEO
  useSeoMeta({
    title: 'Contact Us | Ghana Audit Service',
    description:
      'Contact the Ghana Audit Service. Find our office locations, phone numbers, and email addresses, or send us a message.'
  })

  // Form state
  const form = reactive<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })

  const errors = reactive<Partial<Record<keyof ContactFormData, string>>>({})
  const isSubmitting = ref(false)
  const submitSuccess = ref(false)
  const submitError = ref('')
  const csrfToken = ref('')

  const route = useRoute()

  onMounted(async () => {
    // Pre-fill form from query params (e.g. broken report link)
    if (route.query.subject && typeof route.query.subject === 'string') {
      form.subject = route.query.subject
    }
    if (route.query.message && typeof route.query.message === 'string') {
      form.message = route.query.message
    }

    // Fetch CSRF token
    try {
      const response = await $fetch<{ token: string }>('/api/csrf')
      csrfToken.value = response.token
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error)
    }
  })

  // Fetch offices
  const { data: offices } = await useFetch<Office[]>('/api/offices')
  const expandedRegions = ref<Set<string>>(new Set())

  interface RegionGroup {
    region: string
    regionalOffice: Office | undefined
    districtOffices: Office[]
  }

  const groupedOffices = computed<RegionGroup[]>(() => {
    if (!offices.value) return []

    const map = new Map<string, { regional: Office | undefined; districts: Office[] }>()

    for (const office of offices.value) {
      if (!map.has(office.region)) {
        map.set(office.region, { regional: undefined, districts: [] })
      }
      const group = map.get(office.region)!
      if (office.type === 'Regional Office') {
        group.regional = office
      } else {
        group.districts.push(office)
      }
    }

    return Array.from(map.entries())
      .map(([region, { regional, districts }]) => ({
        region,
        regionalOffice: regional,
        districtOffices: districts
      }))
      .sort((a, b) => a.region.localeCompare(b.region))
  })

  function toggleRegion(region: string) {
    if (expandedRegions.value.has(region)) {
      expandedRegions.value.delete(region)
    } else {
      expandedRegions.value.add(region)
    }
  }

  function isRegionExpanded(region: string) {
    return expandedRegions.value.has(region)
  }

  // FAQ data
  const faqs = [
    {
      icon: '?',
      question: 'What does the Ghana Audit Service do?',
      answer:
        'The Ghana Audit Service is the Supreme Audit Institution of Ghana, responsible for auditing the public accounts of Ghana and all public offices including the courts, central and local government administrations, universities and public institutions of like nature, any public corporation or other body or organization established by an Act of Parliament.'
    },
    {
      icon: '?',
      question: 'How can I report financial irregularities or fraud?',
      answer:
        'You can report financial irregularities or suspected fraud by contacting us through this page, emailing info@audit.gov.gh, or visiting any of our regional offices. We treat all reports confidentially and investigate thoroughly.'
    },
    {
      icon: '?',
      question: 'Where can I find audit reports?',
      answer:
        'All published audit reports are available on our Reports page. You can browse by category, year, or search for specific reports. Reports include financial audits, performance audits, compliance audits, and special investigations.'
    },
    {
      icon: '?',
      question: 'How can I apply for a job at the Ghana Audit Service?',
      answer:
        'Current job vacancies are posted on our Careers page. You can view job requirements and application deadlines there. We also post procurement opportunities for those interested in providing services to the GAS.'
    },
    {
      icon: '?',
      question: 'How can I participate in GAS procurement processes?',
      answer:
        'Active tenders and procurement opportunities are listed on our Tenders page. Each listing includes submission deadlines, requirements, and tender documents that you can download to prepare your bid.'
    },
    {
      icon: '?',
      question: 'What are the working hours of the Ghana Audit Service?',
      answer:
        'Our offices are open Monday through Friday from 8:00 AM to 5:00 PM. We are closed on weekends and public holidays. For urgent matters outside working hours, please send an email and we will respond on the next business day.'
    }
  ]

  // Form validation
  function validateForm(): boolean {
    // Reset errors
    Object.keys(errors).forEach((key) => {
      errors[key as keyof ContactFormData] = ''
    })

    let isValid = true

    if (!form.name.trim()) {
      errors.name = 'Full name is required'
      isValid = false
    }

    if (!form.email.trim()) {
      errors.email = 'Email address is required'
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Please enter a valid email address'
      isValid = false
    }

    if (!form.subject) {
      errors.subject = 'Please select a subject'
      isValid = false
    }

    if (!form.message.trim()) {
      errors.message = 'Message is required'
      isValid = false
    } else if (form.message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters'
      isValid = false
    }

    return isValid
  }

  // Form submission
  async function submitForm() {
    if (!validateForm()) return

    isSubmitting.value = true
    submitSuccess.value = false
    submitError.value = ''

    try {
      await $fetch('/api/contact', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken.value
        },
        body: {
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          subject: form.subject,
          message: form.message
        }
      })

      // Reset form on success
      form.name = ''
      form.email = ''
      form.phone = ''
      form.subject = ''
      form.message = ''

      submitSuccess.value = true
    } catch (error: unknown) {
      console.error('Failed to submit form:', error)

      // Handle validation errors from server
      if (error && typeof error === 'object' && 'data' in error) {
        const errorData = error as { data?: { errors?: Record<string, string> } }
        if (errorData.data?.errors) {
          Object.assign(errors, errorData.data.errors)
        }
      }

      submitError.value = 'Failed to send message. Please try again.'
    } finally {
      isSubmitting.value = false
    }
  }
</script>
