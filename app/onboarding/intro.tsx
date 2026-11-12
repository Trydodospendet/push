import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { IntroPager } from '@/features/intro/intro-pager';
import { useIntro } from '@/features/intro/intro-provider';

/**
 * Shown once after the first login on this phone. When the pages are done, "/" is opened and
 * the root layout sends the user to the next missing step (name, health or home).
 */
export default function OnboardingIntroScreen() {
  const router = useRouter();
  const intro = useIntro();

  useEffect(() => {
    if (intro.seen) {
      router.replace('/');
    }
  }, [intro.seen, router]);

  return <IntroPager onFinish={intro.markSeen} />;
}
