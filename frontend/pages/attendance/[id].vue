<template>
  <div>
    <div class="flex items-center gap-2 mb-6">
      <UButton variant="ghost" icon="i-heroicons-arrow-left" size="sm" @click="router.back()">
        Voltar
      </UButton>
    </div>

    <div v-if="record" class="flex flex-col gap-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Registo de Presença</h2>
            <UBadge :color="statusColor(record.status)" variant="soft">
              {{ record.status }}
            </UBadge>
          </div>
        </template>

        <dl class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400">ID do Registo</dt>
            <dd class="font-mono mt-1">{{ record.recordId }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Data de Registo</dt>
            <dd class="mt-1">{{ formatDate(record.registeredAt) }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">ID da Sessão</dt>
            <dd class="font-mono mt-1">{{ record.sessionId }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">ID do Deputado</dt>
            <dd class="font-mono mt-1">{{ record.deputyId }}</dd>
          </div>
          <div v-if="record.failureReason" class="col-span-2">
            <dt class="text-gray-500 dark:text-gray-400">Motivo de Falha</dt>
            <dd class="mt-1 text-red-500">{{ record.failureReason }}</dd>
          </div>
        </dl>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="font-semibold">Dados Blockchain</h3>
        </template>

        <dl class="flex flex-col gap-3 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400 mb-1">Tx Hash</dt>
            <dd class="font-mono break-all text-xs bg-gray-100 dark:bg-gray-800 rounded p-2">
              {{ record.txHash ?? '—' }}
            </dd>
          </div>
          <div class="grid grid-cols-2 gap-x-8">
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Bloco</dt>
              <dd class="font-mono mt-1">{{ record.blockNumber ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Contrato</dt>
              <dd class="font-mono mt-1 text-xs">{{ record.contractAddress ?? '—' }}</dd>
            </div>
          </div>
        </dl>

        <template #footer>
          <div class="flex items-center justify-between">
            <UButton
              :loading="verifying"
              :disabled="!record.txHash"
              icon="i-heroicons-shield-check"
              @click="runVerify"
            >
              Verificar na Blockchain
            </UButton>
            <span v-if="!record.txHash" class="text-xs text-gray-400">
              Registo sem Tx Hash — não submetido
            </span>
          </div>
        </template>
      </UCard>

      <UCard v-if="verifyResult">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              :name="verifyResult.overallResult === 'CHAIN_VALID'
                ? 'i-heroicons-check-badge'
                : 'i-heroicons-x-circle'"
              :class="verifyResult.overallResult === 'CHAIN_VALID'
                ? 'text-green-500'
                : 'text-red-500'"
              class="w-5 h-5"
            />
            <h3 class="font-semibold">Resultado da Verificação</h3>
            <UBadge
              :color="verifyResult.overallResult === 'CHAIN_VALID' ? 'green' : 'red'"
              variant="soft"
            >
              {{ verifyResult.overallResult === 'CHAIN_VALID' ? 'Blockchain válido' : 'Falha na verificação' }}
            </UBadge>
          </div>
        </template>

        <dl class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Registo encontrado na chain</dt>
            <dd class="mt-1">
              <UBadge :color="verifyResult.blockchainRecordFound ? 'green' : 'red'" variant="soft">
                {{ verifyResult.blockchainRecordFound ? 'Sim' : 'Não' }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Hash corresponde</dt>
            <dd class="mt-1">
              <UBadge :color="verifyResult.blockchainHashMatches ? 'green' : 'red'" variant="soft">
                {{ verifyResult.blockchainHashMatches ? 'Sim' : 'Não' }}
              </UBadge>
            </dd>
          </div>
          <div class="col-span-2">
            <dt class="text-gray-500 dark:text-gray-400 mb-1">Hash on-chain</dt>
            <dd class="font-mono break-all text-xs bg-gray-100 dark:bg-gray-800 rounded p-2">
              {{ verifyResult.onChainHash ?? '—' }}
            </dd>
          </div>
        </dl>
      </UCard>

      <UAlert
        v-if="verifyError"
        color="red"
        variant="soft"
        :description="verifyError"
        icon="i-heroicons-exclamation-circle"
      />
    </div>

    <UAlert
      v-if="recordError"
      color="red"
      variant="soft"
      description="Erro ao carregar registo."
      icon="i-heroicons-exclamation-circle"
    />
  </div>
</template>

<script setup lang="ts">
import type { VerifyResult } from '~/composables/useAttendance'

const route = useRoute()
const router = useRouter()
const recordId = route.params.id as string

const { fetchRecord, verifyRecord } = useAttendance()

const { data: record, error: recordError } = await useAsyncData(
  `attendance-${recordId}`,
  () => fetchRecord(recordId),
)

const verifyResult = ref<VerifyResult | null>(null)
const verifyError = ref<string | null>(null)
const verifying = ref(false)

const runVerify = async () => {
  verifyResult.value = null
  verifyError.value = null
  verifying.value = true
  try {
    verifyResult.value = await verifyRecord(recordId)
  } catch {
    verifyError.value = 'Erro ao verificar registo na blockchain.'
  } finally {
    verifying.value = false
  }
}

const statusColor = (status: string) =>
  status === 'SUBMITTED' ? 'green' : 'yellow'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
</script>
