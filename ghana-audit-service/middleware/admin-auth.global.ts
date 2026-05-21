import { moduleForAdminPage } from '~/composables/useAdminAuth'

export default defineNuxtRouteMiddleware((to) => {
  // Only apply to admin routes
  if (!to.path.startsWith('/admin')) {
    return
  }

  const { isAuthenticated, token, isSessionExpired, hasModule } = useAdminAuth()

  // Redirect logged-in users away from login page
  if (to.path === '/admin/login') {
    if (isAuthenticated()) {
      return navigateTo('/admin')
    }
    return
  }

  // Check if user is authenticated (init() is called by plugin)
  if (!isAuthenticated()) {
    // A stored-but-dead session means the user was logged in and timed
    // out — surface that on the login screen instead of a silent bounce.
    const query: Record<string, string> = { redirect: to.fullPath }
    if (token.value && isSessionExpired()) {
      query.reason = 'expired'
    }
    return navigateTo({ path: '/admin/login', query })
  }

  // Block deep-linking to a page outside the user's module scope.
  const pageModule = moduleForAdminPage(to.path)
  if (pageModule && !hasModule(pageModule)) {
    return navigateTo('/admin')
  }
})
