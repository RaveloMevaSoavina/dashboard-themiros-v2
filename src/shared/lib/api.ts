const apiUrl = (
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "")

type ApiErrorPayload = {
  detail?: string
  code?: string
  context?: Record<string, unknown>
}

export class ApiError extends Error {
  code: string
  context: Record<string, unknown>
  status: number

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.detail ?? `API request failed (${status})`)
    this.name = "ApiError"
    this.status = status
    this.code = payload.code ?? "API_ERROR"
    this.context = payload.context ?? {}
  }
}

async function apiFetch(
  path: string,
  options: RequestInit & { accessToken: string }
) {
  const { accessToken, headers, ...requestOptions } = options
  const response = await fetch(`${apiUrl}${path}`, {
    ...requestOptions,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...headers,
    },
  })

  if (!response.ok) {
    let payload: ApiErrorPayload = {}
    try {
      payload = (await response.json()) as ApiErrorPayload
    } catch {
      payload = { detail: response.statusText }
    }
    throw new ApiError(response.status, payload)
  }

  return response
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { accessToken: string }
): Promise<T> {
  const response = await apiFetch(path, options)
  return (await response.json()) as T
}

/** Fichier produit par l'API, avec le nom qu'elle lui donne. */
export async function apiDownload(
  path: string,
  options: RequestInit & { accessToken: string; fallbackName: string }
): Promise<{ blob: Blob; filename: string; headers: Headers }> {
  const { fallbackName, ...requestOptions } = options
  const response = await apiFetch(path, requestOptions)
  const disposition = response.headers.get("Content-Disposition") ?? ""
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName
  return { blob: await response.blob(), filename, headers: response.headers }
}
