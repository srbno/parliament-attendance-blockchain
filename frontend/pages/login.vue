<template>
  <NuxtLayout name="empty">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-building-library" class="w-6 h-6 text-primary-500" />
          <h1 class="text-lg font-semibold">Auditoria Parlamentar</h1>
        </div>
      </template>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <UFormGroup label="Utilizador" name="username">
          <UInput v-model="form.username" placeholder="username" autocomplete="username" />
        </UFormGroup>

        <UFormGroup label="Palavra-passe" name="password">
          <UInput
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
          />
        </UFormGroup>

        <UAlert
          v-if="error"
          color="red"
          variant="soft"
          :description="error"
          icon="i-heroicons-exclamation-circle"
        />

        <UButton type="submit" block :loading="loading">
          Entrar
        </UButton>
      </form>
    </UCard>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { login, isAuthenticated } = useAuth()

if (isAuthenticated.value) {
  await navigateTo('/deputies', { replace: true })
}

const form = reactive({ username: '', password: '' })
const error = ref<string | null>(null)
const loading = ref(false)

const onSubmit = async () => {
  error.value = null
  loading.value = true
  try {
    await login(form.username, form.password)
    await navigateTo('/deputies', { replace: true })
  } catch {
    error.value = 'Credenciais inválidas. Tente novamente.'
  } finally {
    loading.value = false
  }
}
</script>
