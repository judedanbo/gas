<template>
  <section class="section bg-gray-50 dark:bg-gray-900">
    <div class="container">
      <div class="max-w-4xl mx-auto">
        <div class="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <!-- Photo -->
          <div class="flex-shrink-0">
            <img
              src="/images/ags/johnson_akuamoah_asiedu.jpg"
              alt="Johnson Akuamoah Asiedu, Auditor-General of Ghana"
              class="w-48 h-48 md:w-64 md:h-64 rounded-2xl object-cover shadow-lg"
            />
          </div>
          <!-- Content -->
          <div class="flex-1 text-center md:text-left">
            <span
              class="inline-block bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold mb-4"
            >
              Message from the Auditor-General
            </span>
            <h2
              class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white mb-2"
            >
              Johnson Akuamoah Asiedu
            </h2>
            <p class="text-gray-600 dark:text-gray-400 text-lg mb-6">Auditor-General of Ghana</p>
            <blockquote
              class="font-heading text-md italic text-gray-600 dark:text-gray-400 leading-relaxed border-l-4 border-accent pl-6 text-left m-0"
            >
              "Our role as a public service is to audit and report on the public accounts of Ghana
              and all public offices. Our work as state auditors is vital to the sustenance of the
              economy of our nation. We therefore pledge as a Service to perform our constitutional
              mandate to help protect the public purse."
            </blockquote>
            <NuxtLink
              to="/about/the-service"
              class="inline-flex items-center gap-1 text-primary dark:text-accent text-sm font-semibold mt-4 hover:underline"
            >
              Read full message
              <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
