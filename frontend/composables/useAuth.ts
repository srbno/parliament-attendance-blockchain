import { navigateTo, useCookie, useRuntimeConfig } from "nuxt/app";
import { computed } from "vue";

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
  const username = useCookie<string | null>('auth-username', {
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

  const login = async (user: string, password: string) => {
    const data = await $fetch<{ accessToken: string }>('/auth/login', {
      baseURL: config.public.apiBase as string,
      method: 'POST',
      body: { username: user, password },
    })
    token.value = data.accessToken
    username.value = user
  }

  const logout = () => {
    token.value = null
    username.value = null
    return navigateTo('/login')
  }

  return { token, username, isAuthenticated, authHeaders, role, deputyId, login, logout }
}
