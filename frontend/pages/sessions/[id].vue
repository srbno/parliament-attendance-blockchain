<template>
  <div>
    <div class="flex items-center gap-2 mb-6">
      <UButton variant="ghost" icon="i-heroicons-chevron-left" size="sm" @click="router.back()">
        Voltar
      </UButton>
    </div>

    <div v-if="session" class="flex flex-col gap-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ session.title }}</h2>
            <UBadge :color="statusColor(session.status)" variant="soft">
              {{ session.status }}
            </UBadge>
          </div>
        </template>

        <dl class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Tipo</dt>
            <dd class="mt-1">{{ session.sessionType }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Múltiplos check-ins</dt>
            <dd class="mt-1">{{ session.allowMultipleCheckins ? 'Sim' : 'Não' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Início agendado</dt>
            <dd class="mt-1">{{ formatDate(session.scheduledStart) }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Fim agendado</dt>
            <dd class="mt-1">{{ formatDate(session.scheduledEnd) }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Check-in abre</dt>
            <dd class="mt-1">{{ formatDate(session.checkinStart) }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Check-in fecha</dt>
            <dd class="mt-1">{{ formatDate(session.checkinEnd) }}</dd>
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
            :loading="recordsPending || deputiesPending"
            @select="onSelectRecord"
          >
            <template #deputyName-data="{ row }">
              <div>
                <div class="font-medium">{{ row.deputyName }}</div>
                <div class="text-xs text-gray-400 font-mono">ID {{ row.deputyId }}</div>
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
        </UCard>
      </div>
    </div>

    <UAlert
      v-if="sessionError"
      color="red"
      variant="soft"
      description="Erro ao carregar sessão."
      icon="i-heroicons-exclamation-circle"
    />
  </div>
</template>

<script setup lang="ts">
import type { AttendanceRecord } from '~/composables/useAttendance'

const route = useRoute()
const router = useRouter()
const sessionId = route.params.id as string

const { fetchOne } = useSessions()
const { fetchBySession } = useAttendance()
const { fetchAll: fetchAllDeputies } = useDeputies()

const { data: session, error: sessionError } = await useAsyncData(
  `session-${sessionId}`,
  () => fetchOne(sessionId),
)

const { data: records, pending: recordsPending } = await useAsyncData(
  `records-session-${sessionId}`,
  () => fetchBySession(sessionId),
)

const { data: deputies, pending: deputiesPending } = await useAsyncData(
  'deputies-lookup',
  fetchAllDeputies,
)

const deputyMap = computed(() => {
  const map = new Map<string, string>()
  for (const d of deputies.value ?? []) {
    map.set(String(d.id), d.name)
  }
  return map
})

const enrichedRecords = computed(() =>
  (records.value ?? []).map(r => ({
    ...r,
    deputyName: deputyMap.value.get(r.deputyId) ?? `Deputado ${r.deputyId}`,
  })),
)

const recordColumns = [
  { key: 'deputyName', label: 'Deputado' },
  { key: 'registeredAt', label: 'Data de Registo' },
  { key: 'status', label: 'Estado' },
  { key: 'txHash', label: 'Tx Hash' },
]

const onSelectRecord = (row: AttendanceRecord) => navigateTo(`/attendance/${row.recordId}`)

const statusColor = (status: string) => {
  if (status === 'OPEN') return 'green'
  if (status === 'CLOSED') return 'gray'
  if (status === 'CANCELLED') return 'red'
  return 'yellow'
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
</script>
