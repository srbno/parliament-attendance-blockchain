<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <UContainer class="py-4">
      <header class="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 mb-6">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-building-library" class="w-6 h-6 text-primary-500" />
            <span class="font-semibold text-lg">
              Parlamento — {{ role === 'DEPUTY' ? 'Deputado' : 'Auditoria' }}
            </span>
          </div>
          <nav class="flex items-center gap-1">
            <template v-if="role === 'DEPUTY'">
              <UButton
                :variant="isActive('/deputy/submit') ? 'solid' : 'ghost'"
                to="/deputy/submit"
                size="sm"
              >Submeter Presença</UButton>
              <UButton
                :variant="isActive('/deputy/records') ? 'solid' : 'ghost'"
                to="/deputy/records"
                size="sm"
              >Os Meus Registos</UButton>
            </template>
            <template v-else>
              <UButton
                :variant="isActive('/sessions') ? 'solid' : 'ghost'"
                to="/sessions"
                size="sm"
              >Sessões</UButton>
              <UButton
                :variant="isActive('/deputies') ? 'solid' : 'ghost'"
                to="/deputies"
                size="sm"
              >Deputados</UButton>
            </template>
          </nav>
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
const { logout, role } = useAuth()
const route = useRoute()
const isActive = (path: string) => route.path.startsWith(path)
</script>
