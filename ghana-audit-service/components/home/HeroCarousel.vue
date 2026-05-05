<template>
  <section class="bg-gradient-to-br from-primary to-primary-dark text-white py-20 text-center">
    <div class="container">
      <div class="max-w-[800px] mx-auto">
        <h1 class="text-3xl md:text-5xl text-white mb-4">Ghana Audit Service</h1>
        <p class="text-xl md:text-2xl text-accent mb-4 font-semibold">
          Protecting the Public Purse Through Accountability and Transparency
        </p>
        <p class="text-lg text-white/90 mb-8 leading-relaxed">
          The Audit Service has a constitutional mandate to audit the accounts of all public offices
          and report to Parliament, ensuring accountability in the use of public resources.
        </p>
        <div class="flex gap-4 justify-center flex-wrap">
          <NuxtLink to="/reports" class="btn-accent btn-lg"> View Latest Reports </NuxtLink>
          <NuxtLink
            to="/about"
            class="btn border-2 border-white text-white hover:bg-white hover:text-primary"
          >
            Learn More
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
