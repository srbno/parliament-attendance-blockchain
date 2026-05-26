export interface Session {
  id: string
  title: string
  sessionType: string
  locationId: string
  scheduledStart: string
  scheduledEnd: string
  checkinStart: string
  checkinEnd: string
  status: string
  allowMultipleCheckins: boolean
  createdAt: string
  updatedAt: string
}

export const useSessions = () => {
  const config = useRuntimeConfig()
  const { token } = useAuth()

  const getHeaders = () => ({
    Authorization: `Bearer ${token.value ?? ''}`,
  })

  const fetchAll = async (): Promise<Session[]> => {
    return $fetch('/sessions', {
      baseURL: config.public.apiBase,
      headers: getHeaders(),
    })
  }

  const fetchOne = async (id: string | number): Promise<Session> => {
    return $fetch(`/sessions/${id}`, {
      baseURL: config.public.apiBase,
      headers: getHeaders(),
    })
  }

  return { fetchAll, fetchOne }
}
