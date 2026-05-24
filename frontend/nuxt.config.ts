export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3001',
    },
  },
  devtools: { enabled: false },
  compatibilityDate: '2024-11-01',
})
