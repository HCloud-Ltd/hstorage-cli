export interface Route {
  method: string
  path: string
  status?: number
  body: unknown
  handler?: (url: URL, body: unknown) => { status?: number; body: unknown }
}

export interface RecordedRequest {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

export interface MockServer {
  url: string
  requests: RecordedRequest[]
  stop: () => void
}

export function createMockServer(routes: Route[]): MockServer {
  const requests: RecordedRequest[] = []

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      const path = url.pathname
      const method = req.method.toUpperCase()

      const rawHeaders = Object.fromEntries(req.headers.entries())

      let body: unknown = null
      try {
        const text = await req.text()
        if (text !== '') {
          const contentType = req.headers.get('content-type') ?? ''
          if (contentType.includes('application/json')) {
            try {
              body = JSON.parse(text)
            } catch {
              body = text
            }
          } else {
            body = text
          }
        }
      } catch {
        body = null
      }

      requests.push({
        method,
        path,
        headers: rawHeaders,
        body,
      })

      const route = routes.find((r) => r.method.toUpperCase() === method && r.path === path)

      if (!route) {
        return new Response('Not Found', { status: 404 })
      }

      if (route.handler) {
        const result = route.handler(url, body)
        return new Response(JSON.stringify(result.body), {
          status: result.status ?? 200,
          headers: {
            'content-type': 'application/json',
          },
        })
      }

      return new Response(JSON.stringify(route.body), {
        status: route.status ?? 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    },
  })

  return {
    url: server.url.toString().replace(/\/$/, ''),
    requests,
    stop: () => {
      server.stop()
    },
  }
}
