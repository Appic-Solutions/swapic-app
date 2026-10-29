import { config } from '@/config';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly path: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;

function urlOf(path: string, query?: Query): string {
  const u = new URL(path, config.apiBase);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  }
  return u.toString();
}

function signalOf(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function read<T>(res: Response, path: string): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (res.ok) {
    if (body === undefined) throw new ApiError(res.status, 'badAnswer', 'the answer is not JSON', path);
    return body as T;
  }
  const b = body as { code?: unknown; message?: unknown } | undefined;
  const code =
    typeof b?.code === 'string' ? b.code : res.status === 429 ? 'edgeLimited' : res.status >= 500 ? 'edgeUnavailable' : 'httpError';
  throw new ApiError(res.status, code, typeof b?.message === 'string' ? b.message : `HTTP ${res.status}`, path);
}

async function call<T>(path: string, init: RequestInit, signal: AbortSignal | undefined): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal, credentials: 'omit', cache: 'no-store' });
  } catch (err) {
    if (signal?.aborted && (signal.reason as Error | undefined)?.name !== 'TimeoutError') throw err;
    throw new ApiError(0, 'network', 'the server did not answer', new URL(path).pathname);
  }
  return read<T>(res, new URL(path).pathname);
}

/** GET with no custom header: a simple request, no preflight (contract 1.5). */
export function getJson<T>(path: string, query?: Query, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<T> {
  return call<T>(urlOf(path, query), { method: 'GET' }, signalOf(opts?.signal, opts?.timeoutMs ?? 15_000));
}

export function postJson<T>(path: string, body: unknown, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<T> {
  return call<T>(
    urlOf(path),
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    signalOf(opts?.signal, opts?.timeoutMs ?? 20_000),
  );
}
