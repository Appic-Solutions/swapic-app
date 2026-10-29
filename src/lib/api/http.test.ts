import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getJson, postJson } from './http';

const answer = (status: number, body: string, type = 'application/json') =>
  vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(body, { status, headers: { 'content-type': type } }));

afterEach(() => vi.unstubAllGlobals());

describe('http', () => {
  it('reads JSON and builds the query from defined fields only', async () => {
    const f = answer(200, '{"ok":true}');
    vi.stubGlobal('fetch', f);
    await expect(getJson('/v2/tokens', { chain: 'eip155:8453', q: undefined, cursor: '' })).resolves.toEqual({ ok: true });
    expect(String(f.mock.calls[0]![0])).toBe('https://api.e2e.swapic.invalid/v2/tokens?chain=eip155%3A8453');
  });
  it('throws the service code and message (recorded watcher refusal)', async () => {
    vi.stubGlobal('fetch', answer(422, '{"code":"reverts","message":"runFor reverts: CallFailed"}'));
    await expect(postJson('/v2/orders', {})).rejects.toMatchObject({ status: 422, code: 'reverts' });
  });
  it('turns an nginx HTML 502 into edgeUnavailable, never a parse crash', async () => {
    vi.stubGlobal('fetch', answer(502, '<html><body>Bad Gateway</body></html>', 'text/html'));
    await expect(getJson('/v2/pool')).rejects.toMatchObject({ status: 502, code: 'edgeUnavailable' });
  });
  it('turns an empty 429 into edgeLimited and a dead network into network', async () => {
    vi.stubGlobal('fetch', answer(429, ''));
    await expect(getJson('/v2/quote')).rejects.toMatchObject({ code: 'edgeLimited' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(getJson('/v2/quote')).rejects.toBeInstanceOf(ApiError);
  });
  it('posts JSON with only the content-type header (one preflight, contract 1.5)', async () => {
    const f = answer(202, '{"orderId":"0xab","status":"submitted"}');
    vi.stubGlobal('fetch', f);
    await postJson('/v2/orders', { a: 1 });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.credentials).toBe('omit');
  });
});
