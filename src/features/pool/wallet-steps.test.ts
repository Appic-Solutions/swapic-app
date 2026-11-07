import { describe, expect, it } from 'vitest';
import { APPROVING, WAITING_CONFIRMATION } from '@/lib/copy/status';
import { walletSteps } from './components/ReviewParts';

describe('walletSteps (Review stake\'s wallet steps)', () => {
  const steps = [{ label: 'Approve USDC (you pay gas)', sub: 'Lets Swapic use 5 USDC' }, { label: 'Confirm stake (you pay gas)', sub: 'About 0.0001 ETH' }];
  it('the open step asks to check the wallet, and once its transaction was sent says the network is awaited', () => {
    expect(walletSteps(steps, ['wait', 'todo']).map((s) => s.sub)).toEqual(['Check your wallet', 'About 0.0001 ETH']);
    expect(walletSteps(steps, ['wait', 'todo'], APPROVING)[0]!.sub).toBe('Approving, waiting for the network');
    expect(walletSteps(steps, ['done', 'wait'], WAITING_CONFIRMATION).map((s) => s.sub)).toEqual(['Lets Swapic use 5 USDC', 'Waiting for confirmation']);
  });
});
