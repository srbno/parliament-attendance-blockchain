<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold">Sessões Parlamentares</h2>
      <UBadge color="gray" variant="soft">{{ sessions?.length ?? 0 }} sessões</UBadge>
    </div>

    <UCard>
      <UTable
        :rows="sessions ?? []"
        :columns="columns"
        :loading="pending"
        @select="onSelect"
      >
        <template #status-data="{ row }">
          <UBadge :color="statusColor(row.status)" variant="soft">
            {{ row.status }}
          </UBadge>
        </template>

        <template #sessionType-data="{ row }">
          <span class="text-sm">{{ row.sessionType }}</span>
        </template>

        <template #scheduledStart-data="{ row }">
          {{ formatDate(row.scheduledStart) }}
        </template>

        <template #scheduledEnd-data="{ row }">
          {{ formatDate(row.scheduledEnd) }}
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { Session } from '~/composables/useSessions'

const { fetchAll } = useSessions()
const { data: sessions, pending } = await useAsyncData('sessions', fetchAll)

const columns = [
  { key: 'title', label: 'Título' },
  { key: 'sessionType', label: 'Tipo' },
  { key: 'status', label: 'Estado' },
  { key: 'scheduledStart', label: 'Início' },
  { key: 'scheduledEnd', label: 'Fim' },
]

const onSelect = (row: Session) => navigateTo(`/sessions/${row.id}`)

const statusColor = (status: string) => {
  if (status === 'OPEN') return 'green'
  if (status === 'CLOSED') return 'gray'
  if (status === 'CANCELLED') return 'red'
  return 'yellow'
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
</script>
