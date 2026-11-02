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
  it('encodes a route id holding a plus, so the quoter reads the named route and not a space', async () => {
    const f = answer(200, '{"ok":true}');
    vi.stubGlobal('fetch', f);
    await getJson('/v2/quote', { routeId: 'cctpFast+ckMinter', gasMode: 'gasless' });
    expect(String(f.mock.calls[0]![0])).toBe('https://api.e2e.swapic.invalid/v2/quote?routeId=cctpFast%2BckMinter&gasMode=gasless');
  });
  it('throws the service code and message (recorded watcher refusal)', async () => {
    vi.stubGlobal('fetch', answer(422, '{"code":"reverts","message":"runFor reverts: CallFailed"}'));
    await expect(postJson('/v2/orders', {})).rejects.toMatchObject({ status: 422, code: 'reverts' });
  });
  it('reads the cap refusal\'s two optional fields (quoter f626a60), and other errors carry neither', async () => {
    vi.stubGlobal('fetch', answer(422, '{"code":"no_route","message":"... above the 100 cap","reasonCode":"aboveSwapCap","maxUsd":"100"}'));
    await expect(getJson('/v2/quote')).rejects.toMatchObject({ status: 422, code: 'no_route', message: '... above the 100 cap', reasonCode: 'aboveSwapCap', maxUsd: '100' });
    vi.stubGlobal('fetch', answer(422, '{"code":"no_route","message":"no route could carry this swap: eco did not answer"}'));
    const other = await getJson('/v2/quote').catch((x: ApiError) => x);
    expect(other).toBeInstanceOf(ApiError);
    expect('reasonCode' in (other as ApiError)).toBe(false);
    expect('maxUsd' in (other as ApiError)).toBe(false);
    // fields of another type are not read as these
    vi.stubGlobal('fetch', answer(422, '{"code":"no_route","message":"x","reasonCode":7,"maxUsd":100}'));
    const odd = await getJson('/v2/quote').catch((x: ApiError) => x);
    expect((odd as ApiError).reasonCode).toBeUndefined();
    expect((odd as ApiError).maxUsd).toBeUndefined();
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
