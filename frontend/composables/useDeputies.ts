export interface Deputy {
  id: number
  publicIdentifier: string
  name: string
  party: string
  electoralCircle: string
  active: boolean
}

export const useDeputies = () => {
  const config = useRuntimeConfig()
  const { token } = useAuth()

  const getHeaders = () => ({
    Authorization: `Bearer ${token.value ?? ''}`,
  })

  const fetchAll = async (): Promise<Deputy[]> => {
    return $fetch('/deputies', {
      baseURL: config.public.apiBase,
      headers: getHeaders(),
    })
  }

  const fetchOne = async (id: string | number): Promise<Deputy> => {
    return $fetch(`/deputies/${id}`, {
      baseURL: config.public.apiBase,
      headers: getHeaders(),
    })
  }

  return { fetchAll, fetchOne }
}
