import { getJson, postJson } from './http';
import type * as W from './watcher-types';

const enc = encodeURIComponent;

export const submitGasless = (b: W.GaslessSubmit) => postJson<{ orderId: string; status: 'submitted'; signedTxId?: number }>('/v2/orders', b);
export const getOrder = (id: string) => getJson<W.OrderStatusAnswer>(`/v2/orders/${enc(id)}`);
export const getOrders = (wallets: string[], cursor?: string) =>
  getJson<W.OrdersPage>('/v2/orders', { wallets: wallets.slice(0, 20).join(','), cursor });
export const postWithdraw = (b: W.WithdrawSubmit) => postJson<{ id: number; burned: string }>('/v2/withdraw', b);
export const getPayout = (id: number) => getJson<W.PayoutAnswer>(`/v2/payouts/${id}`);
export const getScannerLatest = (cursor?: string, kind?: 'swap' | 'stake' | 'withdraw') =>
  getJson<W.ScannerPage>('/v2/scanner/latest', { cursor, kind });
export const getScannerStats = () => getJson<W.ScannerStats>('/v2/scanner/stats');
export const searchScanner = (q: string, cursor?: string) => getJson<W.SearchAnswer>('/v2/scanner/search', { q, cursor });
export const getSteps = (id: string) => getJson<W.StepsAnswer>(`/v2/orders/${enc(id)}/steps`);
export const findDeposit = (b: { chain: string; tx: string }) => postJson<W.FindAnswer>('/v2/deposits/find', b);
