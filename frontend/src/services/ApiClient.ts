export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** Creates a small, typed JSON client that can also be exercised in Jest. */
export function createApiClient(baseUrl: string, fetchFunction: FetchFunction = fetch) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchFunction(`${normalizedBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })

    if (!response.ok) {
      let message = `Request failed (${response.status})`
      try {
        const payload = (await response.json()) as { detail?: string; message?: string }
        message = payload.detail ?? payload.message ?? message
      } catch {
        // Keep the status-based message when the response has no JSON body.
      }
      throw new Error(message)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  return { request }
}
