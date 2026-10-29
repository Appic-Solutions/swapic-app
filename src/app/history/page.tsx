import { Shell } from '@/components/layout/Shell';
import { HistoryPanel } from '@/features/history/HistoryPanel';

export default function Page() {
  return (
    <Shell tab="History">
      <HistoryPanel />
    </Shell>
  );
}
