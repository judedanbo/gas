export default defineNuxtRouteMiddleware((to) => {
  // Only apply to admin routes
  if (!to.path.startsWith('/admin')) {
    return
  }

  const { isAuthenticated } = useAdminAuth()

  // Redirect logged-in users away from login page
  if (to.path === '/admin/login') {
    if (isAuthenticated()) {
      return navigateTo('/admin')
    }
    return
  }

  // Check if user is authenticated (init() is called by plugin)
  if (!isAuthenticated()) {
    // Redirect to login with return URL
    return navigateTo({
      path: '/admin/login',
      query: { redirect: to.fullPath }
    })
  }
})
