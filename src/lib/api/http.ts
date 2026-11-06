import { config } from '@/config';

/**
 * A refused or failed call. `reasonCode` and `maxUsd` are optional fields of the error body (quoter f626a60): a swap or a
 * stake over the canister's per swap cap answers 422 no_route with reasonCode "aboveSwapCap" and maxUsd "100" (whole
 * dollars as a decimal string). A swap too big for the pool answers `poolCovers`, the dollars the pool can carry now. Other
 * errors carry none of these.
 */
export class ApiError extends Error {
  readonly reasonCode?: string;
  readonly maxUsd?: string;
  readonly poolCovers?: string;
  constructor(readonly status: number, readonly code: string, message: string, readonly path: string, extra?: { reasonCode?: string; maxUsd?: string; poolCovers?: string }) {
    super(message);
    this.name = 'ApiError';
    if (extra?.reasonCode !== undefined) this.reasonCode = extra.reasonCode;
    if (extra?.maxUsd !== undefined) this.maxUsd = extra.maxUsd;
    if (extra?.poolCovers !== undefined) this.poolCovers = extra.poolCovers;
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
  const b = body as { code?: unknown; message?: unknown; reasonCode?: unknown; maxUsd?: unknown; poolCovers?: unknown } | undefined;
  const code =
    typeof b?.code === 'string' ? b.code : res.status === 429 ? 'edgeLimited' : res.status >= 500 ? 'edgeUnavailable' : 'httpError';
  const extra = {
    ...(typeof b?.reasonCode === 'string' ? { reasonCode: b.reasonCode } : {}),
    ...(typeof b?.maxUsd === 'string' ? { maxUsd: b.maxUsd } : {}),
    ...(typeof b?.poolCovers === 'string' ? { poolCovers: b.poolCovers } : {}),
  };
  throw new ApiError(res.status, code, typeof b?.message === 'string' ? b.message : `HTTP ${res.status}`, path, extra);
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
