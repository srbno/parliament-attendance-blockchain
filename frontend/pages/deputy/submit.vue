<template>
  <div class="flex flex-col gap-6 w-[80vw] mx-auto">

    <!-- Step 1: Session selection -->
    <UCard v-if="step === 'session'">
      <template #header>
        <h2 class="text-lg font-semibold">Submeter Presença</h2>
        <p class="text-sm text-gray-500 mt-1">Selecione a sessão em que pretende registar presença</p>
      </template>

      <div v-if="sortedSessions.length === 0" class="py-8 text-center text-sm text-gray-500">
        Não há sessões abertas neste momento.
      </div>
      <UTable
        v-else
        :rows="sortedSessions"
        :columns="sessionColumns"
        @select="selectSession"
      >
        <template #sessionType-data="{ row }">
          <UBadge color="blue" variant="soft" size="xs">{{ row.sessionType }}</UBadge>
        </template>
        <template #checkinEnd-data="{ row }">
          {{ formatDate(row.checkinEnd) }}
        </template>
        <template #estado-data="{ row }">
          <UBadge v-if="attendedSessionIds.has(row.id)" color="green" variant="soft" size="xs" icon="i-heroicons-check-circle">
            Submetido
          </UBadge>
        </template>
      </UTable>
    </UCard>

    <!-- Steps 2-4: Camera + verification + submit -->
    <UCard v-if="step !== 'session' && step !== 'success'">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">{{ selectedSession?.title }}</h2>
            <p class="text-xs text-gray-400 mt-1">Verificação de identidade e submissão à blockchain</p>
          </div>
          <UButton v-if="step === 'camera'" variant="ghost" size="xs" @click="goBack">
            Voltar
          </UButton>
        </div>
      </template>

      <div class="flex flex-col items-center gap-4">
        <!-- Live camera feed -->
        <div v-if="step === 'camera' || step === 'verifying' || step === 'confirmed'" class="relative rounded-lg overflow-hidden bg-black aspect-video w-[55%]">
          <video ref="videoEl" autoplay playsinline muted class="w-full h-full object-cover" :class="{ 'opacity-0': !videoReady }" @canplay="videoReady = true" />
          <div v-if="!videoReady" class="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center gap-2">
            <UIcon name="i-heroicons-camera" class="w-10 h-10 text-gray-500" />
            <p class="text-gray-400 text-xs">A iniciar câmara...</p>
          </div>
          <div v-if="step === 'verifying'" class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 text-white animate-spin" />
            <p class="text-white text-sm font-medium">Verificando identidade...</p>
          </div>
          <div v-if="step === 'confirmed'" class="absolute top-3 right-3">
            <UBadge color="green" variant="solid" icon="i-heroicons-check-circle">
              Verificado
            </UBadge>
          </div>
        </div>

        <!-- Identity confirmed banner -->
        <div
          v-if="step === 'confirmed'"
          class="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
        >
          <UIcon name="i-heroicons-check-badge" class="w-6 h-6 text-green-500 flex-shrink-0" />
          <div>
            <p class="font-medium text-green-700 dark:text-green-300">Identidade confirmada</p>
            <p class="text-xs text-green-600 dark:text-green-400 mt-0.5">
              Confiança: {{ ((verifyResult?.confidence ?? 0) * 100).toFixed(0) }}% — pronto para submeter
            </p>
          </div>
        </div>

        <!-- Submitting to blockchain -->
        <div v-if="step === 'submitting'" class="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin text-primary-500 flex-shrink-0" />
          <div>
            <p class="text-sm font-medium">A submeter à blockchain...</p>
            <p class="text-xs text-gray-500 mt-0.5">Aguarde enquanto a transação é processada</p>
          </div>
        </div>

        <!-- Error -->
        <UAlert
          v-if="step === 'error'"
          color="red"
          variant="soft"
          :description="errorMessage ?? 'Erro desconhecido.'"
          icon="i-heroicons-exclamation-circle"
        />
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            v-if="step === 'camera'"
            icon="i-heroicons-eye"
            @click="startVerification"
          >
            Verificar Identidade
          </UButton>
          <UButton
            v-if="step === 'confirmed'"
            icon="i-heroicons-cube-transparent"
            @click="submit"
          >
            Submeter Presença
          </UButton>
          <UButton
            v-if="step === 'error'"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            @click="retry"
          >
            Tentar novamente
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Success -->
    <UCard v-if="step === 'success'">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-500" />
          <h2 class="text-lg font-semibold">Presença registada com sucesso</h2>
        </div>
      </template>

      <dl class="flex flex-col gap-4 text-sm">
        <div>
          <dt class="text-gray-500 dark:text-gray-400 mb-1">Transação blockchain</dt>
          <dd class="font-mono text-xs break-all bg-gray-100 dark:bg-gray-800 rounded p-2">
            {{ submitResult?.blockchain.txHash }}
          </dd>
        </div>
        <div class="grid grid-cols-2 gap-6">
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Bloco</dt>
            <dd class="font-mono mt-1">{{ submitResult?.blockchain.blockNumber ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Estado</dt>
            <dd class="mt-1"><UBadge color="green" variant="soft">SUBMITTED</UBadge></dd>
          </div>
        </div>
      </dl>

      <template #footer>
        <div class="flex gap-3">
          <UButton variant="ghost" @click="reset">Nova submissão</UButton>
          <UButton :to="`/attendance/${submitResult?.recordId}`" icon="i-heroicons-arrow-right">
            Ver registo completo
          </UButton>
        </div>
      </template>
    </UCard>

  </div>
</template>

<script setup lang="ts">
type Step = 'session' | 'camera' | 'verifying' | 'confirmed' | 'submitting' | 'success' | 'error'

interface EdgeVerificationResult {
  verified: boolean
  confidence: number
  gps: { latitude: number; longitude: number; accuracyMeters: number }
  message: string
}

interface SubmitAttendanceResult {
  recordId: string
  status: 'SUBMITTED'
  blockchain: { submitted: boolean; txHash: string; blockNumber: number | null }
}

const { fetchAll } = useSessions()
const { fetchByDeputy } = useAttendance()
const { authHeaders, deputyId } = useAuth()

const [{ data: sessions }, { data: myAttendance }] = await Promise.all([
  useAsyncData('sessions-submit', fetchAll),
  useAsyncData('my-attendance', () => deputyId.value ? fetchByDeputy(deputyId.value) : Promise.resolve([])),
])

const attendedSessionIds = computed(() =>
  new Set((myAttendance.value ?? []).map(r => r.sessionId))
)

const sortedSessions = computed(() => {
  const open = (sessions.value ?? []).filter(s => s.status === 'OPEN')
  return [
    ...open.filter(s => !attendedSessionIds.value.has(s.id)),
    ...open.filter(s => attendedSessionIds.value.has(s.id)),
  ]
})

const sessionColumns = [
  { key: 'title', label: 'Sessão' },
  { key: 'sessionType', label: 'Tipo' },
  { key: 'checkinEnd', label: 'Check-in até' },
  { key: 'estado', label: 'Estado' },
]

const step = ref<Step>('session')
const videoReady = ref(false)
const selectedSession = ref<(typeof sessions.value extends Array<infer T> ? T : never) | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const verifyResult = ref<EdgeVerificationResult | null>(null)
const submitResult = ref<SubmitAttendanceResult | null>(null)
const errorMessage = ref<string | null>(null)

const errorLabels: Record<string, string> = {
  SESSION_NOT_OPEN: 'A sessão não está aberta para check-in.',
  SESSION_NOT_FOUND: 'Sessão não encontrada.',
  DUPLICATE_ATTENDANCE: 'Já registou presença nesta sessão.',
  CHECKIN_WINDOW_CLOSED: 'A janela de check-in está fechada.',
  IP_NOT_AUTHORIZED: 'Endereço IP não autorizado.',
  GPS_OUT_OF_RANGE: 'Localização fora do raio autorizado.',
  GPS_ACCURACY_TOO_LOW: 'Precisão GPS insuficiente.',
  CLIENT_REQUEST_ID_ALREADY_USED: 'Pedido duplicado. Tente novamente.',
}

const selectSession = async (session: typeof selectedSession.value) => {
  if (!session || attendedSessionIds.value.has(session.id)) return
  selectedSession.value = session
  step.value = 'camera'
  await nextTick()
  await startCamera()
}

const startCamera = async () => {
  videoReady.value = false
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
    if (videoEl.value) videoEl.value.srcObject = stream.value
  } catch {
    errorMessage.value = 'Não foi possível aceder à câmara. Verifique as permissões do browser.'
    step.value = 'error'
  }
}

const stopCamera = () => {
  stream.value?.getTracks().forEach(t => t.stop())
  stream.value = null
}

const captureFrame = (): string => {
  const canvas = document.createElement('canvas')
  canvas.width = videoEl.value?.videoWidth || 320
  canvas.height = videoEl.value?.videoHeight || 240
  canvas.getContext('2d')!.drawImage(videoEl.value!, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.8)
}

const startVerification = async () => {
  step.value = 'verifying'
  try {
    const image = captureFrame()
    const result = await $fetch<EdgeVerificationResult>('/api/verify-identity', {
      method: 'POST',
      body: { image },
    })
    verifyResult.value = result
    step.value = 'confirmed'
  } catch {
    errorMessage.value = 'Falha na verificação de identidade. Tente novamente.'
    step.value = 'error'
  }
}

const submit = async () => {
  stopCamera()
  step.value = 'submitting'
  try {
    // Browser → Nitro (mock edge layer) → Fastify backend
    const result = await $fetch<SubmitAttendanceResult>('/api/submit-attendance', {
      method: 'POST',
      headers: authHeaders.value,
      body: { sessionId: String(selectedSession.value!.id) },
    })
    submitResult.value = result
    step.value = 'success'
  } catch (err: unknown) {
    const e = err as { data?: { error?: { code?: string }; message?: string } }
    const code = e?.data?.error?.code ?? e?.data?.message ?? ''
    errorMessage.value = errorLabels[code] ?? 'Erro ao submeter presença. Tente novamente.'
    step.value = 'error'
  }
}

const goBack = () => {
  stopCamera()
  step.value = 'session'
  selectedSession.value = null
  verifyResult.value = null
  errorMessage.value = null
}

const retry = () => {
  errorMessage.value = null
  if (!selectedSession.value) {
    step.value = 'session'
  } else {
    step.value = 'camera'
    nextTick(() => startCamera())
  }
}

const reset = () => {
  step.value = 'session'
  selectedSession.value = null
  verifyResult.value = null
  submitResult.value = null
  errorMessage.value = null
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

onUnmounted(() => stopCamera())
</script>
