import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import type { PushyPose } from '@/features/fur/images';
import { hapticTap } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { layout, spacing } from '@/theme';

import { PUSHY_HEIGHT, Pushy } from './pushy';

/** Pushy at a given height; tapping puts him to sleep (with "Zzz") and wakes him up again. */
export function SleepyPushy({ pose, height }: { pose: PushyPose; height: number }) {
  const [asleep, setAsleep] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={asleep ? de.coach.wake : de.coach.sleep}
      onPress={() => {
        hapticTap();
        setAsleep((value) => !value);
      }}
      style={styles.root}
    >
      <Pushy pose={asleep ? 'sleep' : pose} scale={height / PUSHY_HEIGHT} />
      {asleep ? (
        <Text variant="heading" color="accent" style={styles.zzz}>
          {de.coach.zzz}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { minWidth: layout.minTouchTarget, alignItems: 'center', justifyContent: 'flex-end' },
  zzz: { position: 'absolute', top: spacing.xs, right: -spacing.xs },
});
