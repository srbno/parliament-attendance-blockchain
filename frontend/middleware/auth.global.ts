export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return

  const { isAuthenticated, role } = useAuth()
  if (!isAuthenticated.value) return navigateTo('/login')

  const isDeputy = role.value === 'DEPUTY'

  if (to.path.startsWith('/deputy') && !isDeputy) {
    return navigateTo('/sessions')
  }

  if ((to.path.startsWith('/sessions') || to.path.startsWith('/deputies')) && isDeputy) {
    return navigateTo('/deputy/submit')
  }
})
