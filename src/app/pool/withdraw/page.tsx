import { Shell } from '@/components/layout/Shell';
import { PoolFlow } from '@/features/pool/components/PoolFlow';

export default function Page() {
  return (
    <Shell tab="Pool">
      <PoolFlow start="withdraw" />
    </Shell>
  );
}
