import { createCipheriv, randomBytes } from 'node:crypto'
import type { ApiError, ErrorMsg, RateLimitError } from '../types/api'
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

function isErrorMsg(payload: unknown): payload is ErrorMsg {
  return (
    typeof payload === 'object'
    && payload !== null
    && typeof (payload as ErrorMsg).title === 'string'
    && typeof (payload as ErrorMsg).msg === 'string'
    && typeof (payload as ErrorMsg).error === 'string'
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

function getAesAlgorithm(keyLength: number): 'aes-128-gcm' | 'aes-192-gcm' | 'aes-256-gcm' {
  if (keyLength === 16) return 'aes-128-gcm'
  if (keyLength === 24) return 'aes-192-gcm'
  if (keyLength === 32) return 'aes-256-gcm'

  throw createApiError(
    `Invalid secret key length: ${keyLength}. Must be 16, 24, or 32 bytes.`,
    'invalid_secret_key',
  )
}

export function createApiClient(config: HStorageConfig, options?: { baseUrl?: string }): ApiClient {
  const baseUrl = options?.baseUrl || getApiBaseUrl()

  function generateAuthCredentials(): { apiKey: string; nonce: string } {
    const key = Buffer.from(config.secretKey)
    const algorithm = getAesAlgorithm(key.length)
    const nonce = randomBytes(12)
    const cipher = createCipheriv(algorithm, key, nonce)

    const encrypted = Buffer.concat([
      cipher.update(config.apiKey, 'utf8'),
      cipher.final(),
    ])
    const authTag = cipher.getAuthTag()
    const ciphertext = Buffer.concat([encrypted, authTag])

    return {
      apiKey: ciphertext.toString('hex'),
      nonce: nonce.toString('hex'),
    }
  }

  async function request<T>(
    method: RequestMethod,
    path: string,
    body?: unknown,
    params?: QueryParams,
  ): Promise<T> {
    const credentials = generateAuthCredentials()
    const response = await fetch(buildUrl(baseUrl, path, params), {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-eu-api-key': credentials.apiKey,
        'x-eu-email': config.email,
        'x-eu-nonce': credentials.nonce,
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

      if (isErrorMsg(payload)) {
        throw createApiError(payload.msg, payload.error)
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
