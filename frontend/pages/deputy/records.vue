<template>
  <div class="flex flex-col gap-6">
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Os Meus Registos de Presença</h2>
      </template>

      <UTable
        :rows="enrichedRecords"
        :columns="columns"
        :loading="recordsPending || sessionsPending"
        @select="onSelect"
      >
        <template #sessionTitle-data="{ row }">
          <div>
            <div class="font-medium">{{ row.sessionTitle }}</div>
            <div class="text-xs text-gray-400 font-mono">Sessão #{{ row.sessionId }}</div>
          </div>
        </template>

        <template #status-data="{ row }">
          <UBadge :color="row.status === 'SUBMITTED' ? 'green' : 'yellow'" variant="soft">
            {{ row.status }}
          </UBadge>
        </template>

        <template #registeredAt-data="{ row }">
          {{ formatDate(row.registeredAt) }}
        </template>

        <template #txHash-data="{ row }">
          <span v-if="row.txHash" class="font-mono text-xs text-gray-500">
            {{ row.txHash.slice(0, 10) }}…{{ row.txHash.slice(-6) }}
          </span>
          <span v-else class="text-gray-400 text-xs">—</span>
        </template>
      </UTable>

      <template v-if="!recordsPending && enrichedRecords.length === 0" #footer>
        <p class="text-sm text-gray-500 text-center py-2">
          Ainda não tem registos de presença.
          <NuxtLink to="/deputy/submit" class="text-primary-500 underline ml-1">Submeter presença</NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { AttendanceRecord } from '~/composables/useAttendance'

const { deputyId } = useAuth()
const { fetchByDeputy } = useAttendance()
const { fetchAll: fetchAllSessions } = useSessions()

const { data: records, pending: recordsPending } = await useAsyncData(
  `deputy-records-${deputyId.value}`,
  () => deputyId.value ? fetchByDeputy(deputyId.value) : Promise.resolve<AttendanceRecord[]>([]),
)

const { data: sessions, pending: sessionsPending } = await useAsyncData(
  'sessions-for-deputy-records',
  fetchAllSessions,
)

const sessionMap = computed(() => {
  const map = new Map<string, string>()
  for (const s of sessions.value ?? []) {
    map.set(String(s.id), s.title)
  }
  return map
})

const enrichedRecords = computed(() =>
  (records.value ?? []).map(r => ({
    ...r,
    sessionTitle: sessionMap.value.get(r.sessionId) ?? `Sessão ${r.sessionId}`,
  })),
)

const columns = [
  { key: 'sessionTitle', label: 'Sessão' },
  { key: 'registeredAt', label: 'Data de Registo' },
  { key: 'status', label: 'Estado' },
  { key: 'txHash', label: 'Tx Hash' },
]

const onSelect = (row: AttendanceRecord) => navigateTo(`/attendance/${row.recordId}`)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
</script>
