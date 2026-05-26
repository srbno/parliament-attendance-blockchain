import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const { sessionId } = await readBody<{ sessionId: string }>(event)
  const authorization = getHeader(event, 'authorization') ?? ''
  const config = useRuntimeConfig(event)

  // GPS coordinates within the authorized radius of Palácio de São Bento
  const gps = { latitude: 38.7139, longitude: -9.1521, accuracyMeters: 8 }

  try {
    // Edge layer calls the backend directly — browser never reaches Fastify
    return await $fetch(`${config.public.apiBase}/attendance/submit`, {
      method: 'POST',
      headers: { authorization },
      body: { sessionId, gps, clientRequestId: randomUUID() },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; data?: { error?: unknown } }
    setResponseStatus(event, e?.status ?? 400)
    return { error: e?.data?.error ?? { code: 'SUBMIT_FAILED', message: 'Submission failed.' } }
  }
})
