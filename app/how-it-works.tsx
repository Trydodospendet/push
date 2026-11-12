import { router } from 'expo-router';

import { IntroPager } from '@/features/intro/intro-pager';

/** The intro pages again, opened from the profile. */
export default function HowItWorksScreen() {
  return <IntroPager onFinish={() => router.back()} />;
}
