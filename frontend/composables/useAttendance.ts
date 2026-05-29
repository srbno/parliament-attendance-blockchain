export interface AttendanceRecord {
  recordId: string
  deputyId: string
  sessionId: string
  registeredAt: string
  validationPolicyId: string
  validationDetails: unknown
  evidencePayload: unknown
  txHash: string | null
  blockNumber: string | null
  contractAddress: string | null
  status: 'PENDING' | 'SUBMITTED'
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

export interface VerifyResult {
  recordId: string
  databaseStatus: string
  blockchainCheckAvailable: boolean
  blockchainRecordFound: boolean
  blockchainHashMatches: boolean
  onChainHash: string | null
  overallResult: 'CHAIN_VALID' | 'CHAIN_VERIFICATION_FAILED'
}

export const useAttendance = () => {
  const config = useRuntimeConfig()
  const { token } = useAuth()

  const getHeaders = () => ({
    Authorization: `Bearer ${token.value ?? ''}`,
  })

  const fetchByDeputy = async (deputyId: string | number): Promise<AttendanceRecord[]> => {
    return $fetch(`/attendance/deputy/${deputyId}`, {
      baseURL: config.public.apiBase,
      headers: getHeaders(),
    })
  }

  const fetchRecord = async (id: string | number): Promise<AttendanceRecord> => {
    return $fetch(`/attendance/${id}`, {
      baseURL: config.public.apiBase,
      headers: getHeaders(),
    })
  }

  const fetchBySession = async (sessionId: string | number): Promise<AttendanceRecord[]> => {
    return $fetch(`/attendance/session/${sessionId}`, {
      baseURL: config.public.apiBase,
      headers: getHeaders(),
    })
  }

  const verifyRecord = async (id: string | number): Promise<VerifyResult> => {
    return $fetch(`/attendance/${id}/verify`, {
      baseURL: config.public.apiBase,
      headers: getHeaders(),
    })
  }

  return { fetchByDeputy, fetchBySession, fetchRecord, verifyRecord }
}
