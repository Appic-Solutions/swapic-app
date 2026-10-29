import { Shell } from '@/components/layout/Shell';
import { WithdrawFlow } from '@/features/pool/components/WithdrawPanel';

export default function Page() {
  return (
    <Shell tab="Pool">
      <WithdrawFlow />
    </Shell>
  );
}
