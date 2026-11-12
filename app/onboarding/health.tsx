import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { useHealth } from '@/features/health/health-provider';
import { healthSourceName, isAndroid } from '@/features/health/platform';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

/**
 * Our own explanation comes first; only then the system permission dialog. When this screen
 * is answered (connected or postponed) the root layout moves on to the tabs.
 */
export default function OnboardingHealthScreen() {
  const health = useHealth();
  const [connecting, setConnecting] = useState(false);

  const points = isAndroid
    ? [...de.health.introPoints, de.health.introAndroidPoint]
    : de.health.introPoints;

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.health.introTitle}
        </Text>
        <Text color="textSecondary">{de.health.introText(healthSourceName)}</Text>
      </View>
      <View style={styles.points}>
        {points.map((point) => (
          <Text key={point} color="textSecondary">{`• ${point}`}</Text>
        ))}
      </View>
      {health.error !== null ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {health.error}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Button
          label={de.health.connect(healthSourceName)}
          loading={connecting}
          onPress={() => {
            setConnecting(true);
            void health.connect().finally(() => setConnecting(false));
          }}
        />
        <Button label={de.health.skip} variant="secondary" onPress={() => void health.skip()} />
        <Text variant="caption" color="textMuted" align="center">
          {de.health.skipHint}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  points: {
    gap: spacing.sm,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
