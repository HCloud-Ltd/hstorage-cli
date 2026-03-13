import type { ApiError, PostmanReq, PostmanRes, RateLimitError } from '../types/api'
import type { HStorageConfig } from '../types/config'

export const DEFAULT_API_URL = 'https://api.hstorage.io'

export function getApiBaseUrl(): string {
  return process.env.HSTORAGE_API_URL || DEFAULT_API_URL
}

type QueryParams = Record<string, string | number | boolean | undefined>

interface ApiClient {
  get<T>(path: string, params?: QueryParams): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  delete<T>(path: string, params?: QueryParams): Promise<T>
}

type ApiClientError = Error & ApiError
type ApiRateLimitClientError = Error & RateLimitError

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

function parseJsonResponse(text: string): unknown {
  if (text === '') {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function isApiError(payload: unknown): payload is ApiError {
  return (
    typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof (payload as ApiError).error === 'object'
    && (payload as ApiError).error !== null
    && typeof (payload as ApiError).error.code === 'string'
    && typeof (payload as ApiError).error.message === 'string'
    && !('retry_after' in (payload as Record<string, unknown>))
  )
}

function isRateLimitError(payload: unknown): payload is RateLimitError {
  return (
    typeof payload === 'object'
    && payload !== null
    && typeof (payload as RateLimitError).error === 'string'
    && typeof (payload as RateLimitError).message === 'string'
    && typeof (payload as RateLimitError).retry_after === 'number'
  )
}

function buildUrl(baseUrl: string, path: string, params?: QueryParams): string {
  const normalizedBase = baseUrl.replace(/\/$/, '')
  const url = new URL(path, `${normalizedBase}/`)

  if (params === undefined) {
    return url.toString()
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

function createApiError(message: string, code: string): ApiClientError {
  const error = new Error(message) as ApiClientError

  error.error = {
    code,
    message,
  }

  return error
}

function createRateLimitError(message: string, retryAfter: number, code: string): ApiRateLimitClientError {
  const error = new Error(message) as ApiRateLimitClientError

  error.error = code
  error.message = message
  error.retry_after = retryAfter

  return error
}

export function createApiClient(config: HStorageConfig, options?: { baseUrl?: string }): ApiClient {
  const baseUrl = options?.baseUrl || getApiBaseUrl()
  let cachedNonce: string | null = null

  async function getNonce(): Promise<string> {
    if (cachedNonce !== null) {
      return cachedNonce
    }

    const response = await fetch(`${buildUrl(baseUrl, '/api/generate-crypto-key')}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        api_key: config.apiKey,
        secret_key: config.secretKey,
      } satisfies PostmanReq),
    })

    const responseText = await response.text()
    const payload = parseJsonResponse(responseText)

    if (!response.ok) {
      if (isRateLimitError(payload)) {
        throw createRateLimitError(payload.message, payload.retry_after, payload.error)
      }

      if (isApiError(payload)) {
        throw createApiError(payload.error.message, payload.error.code)
      }

      throw createApiError(response.statusText || 'Failed to generate nonce', String(response.status))
    }

    if (
      typeof payload !== 'object'
      || payload === null
      || typeof (payload as PostmanRes).api_key !== 'string'
      || typeof (payload as PostmanRes).nonce !== 'string'
    ) {
      throw createApiError('Invalid nonce response', 'invalid_nonce_response')
    }

    const { nonce } = payload as PostmanRes

    cachedNonce = nonce

    return nonce
  }

  async function request<T>(
    method: RequestMethod,
    path: string,
    body?: unknown,
    params?: QueryParams,
  ): Promise<T> {
    const nonce = await getNonce()
    const response = await fetch(buildUrl(baseUrl, path, params), {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-eu-api-key': config.apiKey,
        'x-eu-email': config.email,
        'x-eu-nonce': nonce,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    const responseText = await response.text()
    const payload = parseJsonResponse(responseText)

    if (!response.ok) {
      if (isRateLimitError(payload)) {
        throw createRateLimitError(payload.message, payload.retry_after, payload.error)
      }

      if (isApiError(payload)) {
        throw createApiError(payload.error.message, payload.error.code)
      }

      throw createApiError(response.statusText || 'Request failed', String(response.status))
    }

    return (payload ?? null) as T
  }

  return {
    get<T>(path: string, params?: QueryParams) {
      return request<T>('GET', path, undefined, params)
    },

    post<T>(path: string, body?: unknown) {
      return request<T>('POST', path, body)
    },

    put<T>(path: string, body?: unknown) {
      return request<T>('PUT', path, body)
    },

    delete<T>(path: string, params?: QueryParams) {
      return request<T>('DELETE', path, undefined, params)
    },
  }
}
