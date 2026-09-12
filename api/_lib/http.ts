export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8')
  }
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function methodNotAllowed(methods: string[]) {
  return json(
    { error: 'Method not allowed' },
    { status: 405, headers: { allow: methods.join(', ') } },
  )
}

export function cacheHeaders(maxAge = 30) {
  return { 'cache-control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}` }
}