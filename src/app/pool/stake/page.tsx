import { Shell } from '@/components/layout/Shell';
import { StakeFlow } from '@/features/pool/components/StakePanel';

export default function Page() {
  return (
    <Shell tab="Pool">
      <StakeFlow />
    </Shell>
  );
}
