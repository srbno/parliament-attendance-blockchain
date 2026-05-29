export const useAuth = () => {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('auth-token', {
    default: () => null,
    maxAge: 60 * 60 * 8, // 8 hours
  })

  const isAuthenticated = computed(() => !!token.value)

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

  return { token, isAuthenticated, authHeaders, login, logout }
}
