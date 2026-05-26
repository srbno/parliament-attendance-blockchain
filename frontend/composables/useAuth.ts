interface JwtClaims {
  sub: string
  role: 'ADMIN' | 'DEPUTY' | 'AUDITOR'
  deputyId: string | null
}

const decodeJwt = (t: string): JwtClaims | null => {
  try {
    return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export const useAuth = () => {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('auth-token', {
    default: () => null,
    maxAge: 60 * 60 * 8,
  })

  const claims = computed(() => token.value ? decodeJwt(token.value) : null)
  const isAuthenticated = computed(() => !!token.value)
  const role = computed(() => claims.value?.role ?? null)
  const deputyId = computed(() => claims.value?.deputyId ?? null)

  const authHeaders = computed(() => ({
    Authorization: token.value ? `Bearer ${token.value}` : '',
  }))

  const login = async (username: string, password: string) => {
    const data = await $fetch<{ accessToken: string }>('/auth/login', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: { username, password },
    })
    token.value = data.accessToken
  }

  const logout = () => {
    token.value = null
    return navigateTo('/login')
  }

  return { token, isAuthenticated, authHeaders, role, deputyId, login, logout }
}
