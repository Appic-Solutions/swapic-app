import { LegacyRedirect } from '@/components/layout/LegacyRedirect';

/** An old platform-v2 route: sends the visitor to its tab. */
export default function Page() {
  return <LegacyRedirect to="/" />;
}
