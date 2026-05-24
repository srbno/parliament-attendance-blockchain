<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <UContainer class="py-4">
      <header class="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 mb-6">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-building-library" class="w-6 h-6 text-primary-500" />
          <span class="font-semibold text-lg">Parlamento — Auditoria</span>
        </div>
        <UButton variant="ghost" icon="i-heroicons-arrow-right-on-rectangle" @click="logout">
          Sair
        </UButton>
      </header>
      <main>
        <slot />
      </main>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
const { logout } = useAuth()
</script>
