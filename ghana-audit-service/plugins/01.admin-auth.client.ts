export default defineNuxtPlugin(() => {
  const { init } = useAdminAuth()
  init()
})
