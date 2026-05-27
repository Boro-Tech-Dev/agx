import { Suspense } from 'react';

import { HazardStripe } from '../../components/ui/ragtag/HazardStripe';
import { RtBadge } from '../../components/ui/ragtag/RtBadge';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col bg-rt-black p-4 font-sans text-rt-ice">
      <HazardStripe />
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <RtBadge />
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-lg border border-app-border bg-app-surface p-4 text-[13px] text-app-muted shadow-xs">
            Loading…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
      </div>
    </main>
  );
}
