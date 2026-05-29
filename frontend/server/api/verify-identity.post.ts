interface EdgeVerificationResult {
  verified: boolean
  confidence: number
  gps: { latitude: number; longitude: number; accuracyMeters: number }
  message: string
}

export default defineEventHandler(async (): Promise<EdgeVerificationResult> => {
  // Simulate identity verification processing time
  await new Promise(r => setTimeout(r, 2200))

  return {
    verified: true,
    confidence: 0.97,
    // GPS coordinates within the authorized radius of Palácio de São Bento
    gps: { latitude: 38.7139, longitude: -9.1521, accuracyMeters: 8 },
    message: 'Identidade confirmada',
  }
})
