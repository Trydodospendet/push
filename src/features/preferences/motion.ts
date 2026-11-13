import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { usePreferences } from './store';

/** True while the system setting "reduce motion" (remove animations) is on. */
export function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) {
          setReduced(value);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/**
 * Whether animations should play: the user's own switch AND the system setting. Components
 * jump to the end state instead of animating when this is false.
 */
export function useMotionEnabled(): boolean {
  const { animations } = usePreferences();
  const systemReduced = useSystemReducedMotion();
  return animations && !systemReduced;
}
