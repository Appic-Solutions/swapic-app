import type { IcpClient } from './client';
import { realIcpClient } from './real';

let client: IcpClient | null = null;

export function icpClient(): IcpClient {
  if (client) return client;
  if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    client = (require('./fake') as typeof import('./fake')).fakeIcpClient();
  } else {
    client = realIcpClient();
  }
  return client;
}

export * from './client';
export * from './errors';
export * from './accounts';
export type {
  PoolError, PoolAccount, IcpAccount, IcpSwapTerms, CkSwapTerms, StakeIcpArgs, WithdrawIcpArgs, EvmWithdrawal, PayoutView, PayoutStatus,
} from './declarations/swapic.did';
