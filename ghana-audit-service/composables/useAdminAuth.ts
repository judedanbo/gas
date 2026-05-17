import type { AdminUser, LoginResponse, MeResponse, Permission, SessionTiming } from '~/types/admin'

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ['read', 'create', 'update', 'delete', 'manage_users'],
  editor: ['read', 'create', 'update'],
  viewer: ['read']
}

export function useAdminAuth() {
  const user = useState<AdminUser | null>('admin-user', () => null)
  const token = useState<string | null>('admin-token', () => null)
  const session = useState<SessionTiming | null>('admin-session', () => null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // True once the stored session's soonest expiry is in the past.
  function isSessionExpired(): boolean {
    if (!session.value) return false
    const expiry = Date.parse(session.value.expiresAt)
    return Number.isFinite(expiry) && expiry <= Date.now()
  }

  // Initialize auth state from localStorage (client-side only)
  function init() {
    if (import.meta.client) {
      const storedToken = localStorage.getItem('admin-token')
      const storedUser = localStorage.getItem('admin-user')
      const storedSession = localStorage.getItem('admin-session')

      if (storedToken && storedUser) {
        try {
          token.value = storedToken
          user.value = JSON.parse(storedUser)
          session.value = storedSession ? JSON.parse(storedSession) : null
        } catch {
          // Invalid stored data, clear it
          clearAuth()
          return
        }

        // A session that already expired while the tab was closed must not
        // render the admin UI as authenticated.
        if (isSessionExpired()) {
          clearAuth()
        }
      }
    }
  }

  // Store auth data
  function setAuth(userData: AdminUser, authToken: string, sessionData?: SessionTiming | null) {
    user.value = userData
    token.value = authToken
    session.value = sessionData ?? null

    if (import.meta.client) {
      localStorage.setItem('admin-token', authToken)
      localStorage.setItem('admin-user', JSON.stringify(userData))
      if (sessionData) {
        localStorage.setItem('admin-session', JSON.stringify(sessionData))
      } else {
        localStorage.removeItem('admin-session')
      }
    }
  }

  // Update only the session timing (after a refresh / keep-alive)
  function setSession(sessionData: SessionTiming) {
    session.value = sessionData
    if (import.meta.client) {
      localStorage.setItem('admin-session', JSON.stringify(sessionData))
    }
  }

  // Clear auth data
  function clearAuth() {
    user.value = null
    token.value = null
    session.value = null

    if (import.meta.client) {
      localStorage.removeItem('admin-token')
      localStorage.removeItem('admin-user')
      localStorage.removeItem('admin-session')
    }
  }

  // Login
  async function login(email: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<LoginResponse>('/api/admin/auth/login', {
        method: 'POST',
        body: { email, password }
      })

      setAuth(response.user, response.token, response.session ?? null)
      return true
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  // Logout
  async function logout(): Promise<void> {
    try {
      if (token.value) {
        await $fetch('/api/admin/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.value}`
          }
        })
      }
    } catch {
      // Ignore logout API errors
    } finally {
      clearAuth()
    }
  }

  // Fetch current user (validate token)
  async function fetchCurrentUser(): Promise<boolean> {
    if (!token.value) return false

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<MeResponse>('/api/admin/auth/me', {
        headers: {
          Authorization: `Bearer ${token.value}`
        }
      })

      user.value = data.user

      if (import.meta.client) {
        localStorage.setItem('admin-user', JSON.stringify(data.user))
      }
      if (data.session) {
        setSession(data.session)
      }

      return true
    } catch {
      // Token invalid, clear auth
      clearAuth()
      return false
    } finally {
      loading.value = false
    }
  }

  // Check if user is authenticated
  function isAuthenticated(): boolean {
    return !!token.value && !!user.value && !isSessionExpired()
  }

  // Check if user has a specific role
  function hasRole(role: 'admin' | 'editor' | 'viewer'): boolean {
    if (!user.value) return false
    return user.value.role === role
  }

  // Check if user has a specific permission
  function hasPermission(permission: Permission): boolean {
    if (!user.value) return false
    const permissions = ROLE_PERMISSIONS[user.value.role] || []
    return permissions.includes(permission)
  }

  // Check multiple permissions (user must have all)
  function hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every((p) => hasPermission(p))
  }

  // Check multiple permissions (user must have at least one)
  function hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some((p) => hasPermission(p))
  }

  // Get auth headers for API calls
  function getAuthHeaders(): Record<string, string> {
    if (!token.value) return {}
    return {
      Authorization: `Bearer ${token.value}`
    }
  }

  return {
    // State
    user: readonly(user),
    token: readonly(token),
    session: readonly(session),
    loading: readonly(loading),
    error,

    // Methods
    init,
    login,
    logout,
    fetchCurrentUser,
    setSession,
    isAuthenticated,
    isSessionExpired,
    hasRole,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    getAuthHeaders,
    clearAuth
  }
}
