export async function parseApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    if (j?.error && typeof j.error === 'string') return j.error
  } catch {
    /* ignore */
  }
  return res.statusText || 'Request failed'
}

export async function apiGetJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' })
  if (!r.ok) throw new Error(await parseApiError(r))
  return r.json() as Promise<T>
}

export async function apiSendJson<T>(
  url: string,
  method: string,
  body?: unknown
): Promise<T | void> {
  const r = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(await parseApiError(r))
  if (r.status === 204) return undefined
  return r.json() as Promise<T>
}

export async function apiPutJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await parseApiError(r))
  if (r.status === 204) return undefined as T
  return r.json() as Promise<T>
}

export async function apiDelete(url: string, body?: unknown): Promise<void> {
  const r = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(await parseApiError(r))
}

export async function apiPostForm(url: string, formData: FormData): Promise<{ image_url: string }> {
  const r = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!r.ok) throw new Error(await parseApiError(r))
  return r.json() as Promise<{ image_url: string }>
}
