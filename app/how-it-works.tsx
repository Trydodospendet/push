import { router } from 'expo-router';

import { Guide } from '@/features/intro/guide';

/** The illustrated guide, opened from the profile. */
export default function HowItWorksScreen() {
  return <Guide onBack={() => router.back()} />;
}
