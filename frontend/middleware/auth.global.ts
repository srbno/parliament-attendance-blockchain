export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return

  const tokenCookie = useCookie<string | null>('auth-token')
  if (!tokenCookie.value) {
    return navigateTo('/login')
  }
})
