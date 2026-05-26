<template>
  <div>
    <div class="flex items-center gap-2 mb-6">
      <UButton variant="ghost" icon="i-heroicons-chevron-left" size="sm" @click="router.back()">
        Voltar
      </UButton>
    </div>

    <div v-if="deputy" class="flex flex-col gap-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ deputy.name }}</h2>
            <UBadge :color="deputy.active ? 'green' : 'gray'" variant="soft">
              {{ deputy.active ? 'Ativo' : 'Inativo' }}
            </UBadge>
          </div>
        </template>

        <dl class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Identificador</dt>
            <dd class="font-mono mt-1">{{ deputy.publicIdentifier }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Partido</dt>
            <dd class="mt-1">{{ deputy.party }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Círculo Eleitoral</dt>
            <dd class="mt-1">{{ deputy.electoralCircle }}</dd>
          </div>
        </dl>
      </UCard>

      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold">Presenças Registadas</h3>
          <UBadge color="gray" variant="soft">{{ records?.length ?? 0 }} registos</UBadge>
        </div>

        <UCard>
          <UTable
            :rows="enrichedRecords"
            :columns="recordColumns"
            :loading="recordsPending || sessionsPending"
            @select="onSelectRecord"
          >
            <template #sessionTitle-data="{ row }">
              <div>
                <div class="font-medium">{{ row.sessionTitle }}</div>
                <div class="text-xs text-gray-400 font-mono">ID {{ row.sessionId }}</div>
              </div>
            </template>

            <template #status-data="{ row }">
              <UBadge :color="statusColor(row.status)" variant="soft">
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
        </UCard>
      </div>
    </div>

    <UAlert
      v-if="deputyError"
      color="red"
      variant="soft"
      description="Erro ao carregar deputado."
      icon="i-heroicons-exclamation-circle"
    />
  </div>
</template>

<script setup lang="ts">
import type { AttendanceRecord } from '~/composables/useAttendance'

const route = useRoute()
const router = useRouter()
const deputyId = route.params.id as string

const { fetchOne } = useDeputies()
const { fetchByDeputy } = useAttendance()
const { fetchAll: fetchAllSessions } = useSessions()

const { data: deputy, error: deputyError } = await useAsyncData(
  `deputy-${deputyId}`,
  () => fetchOne(deputyId),
)

const { data: records, pending: recordsPending } = await useAsyncData(
  `records-deputy-${deputyId}`,
  () => fetchByDeputy(deputyId),
)

const { data: sessions, pending: sessionsPending } = await useAsyncData(
  'sessions-lookup',
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

const recordColumns = [
  { key: 'sessionTitle', label: 'Sessão' },
  { key: 'registeredAt', label: 'Data de Registo' },
  { key: 'status', label: 'Estado' },
  { key: 'txHash', label: 'Tx Hash' },
]

const onSelectRecord = (row: AttendanceRecord) => navigateTo(`/attendance/${row.recordId}`)

const statusColor = (status: string) =>
  status === 'SUBMITTED' ? 'green' : 'yellow'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
</script>
