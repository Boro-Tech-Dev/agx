import { Suspense } from 'react';

import HomeOverview from '../components/home/HomeOverview';
import { HomeOverviewSkeleton } from '../components/home/HomeOverviewSkeleton';

export default function Home() {
  return (
    <Suspense fallback={<HomeOverviewSkeleton />}>
      <HomeOverview />
    </Suspense>
  );
}
