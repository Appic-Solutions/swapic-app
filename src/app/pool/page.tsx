import { Shell } from '@/components/layout/Shell';
import { PoolPanel } from '@/features/pool/components/PoolPanel';

export default function Page() {
  return (
    <Shell tab="Pool">
      <PoolPanel />
    </Shell>
  );
}
