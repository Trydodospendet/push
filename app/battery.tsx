import { Stack } from 'expo-router';
import { Linking, StyleSheet } from 'react-native';

import { Art, Button, Card, FadeIn, Screen, Text } from '@/components';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/**
 * Some phone makers stop apps in the background to save battery, which ends a GPS run when the
 * screen is locked. This screen explains how to let PUSH keep running, per maker.
 */
export default function BatteryScreen() {
  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <Stack.Screen options={{ title: de.battery.title }} />
      <FadeIn style={styles.hero}>
        <Art name="bolt" size={120} />
        <Text color="textSecondary">{de.battery.intro}</Text>
      </FadeIn>
      {de.battery.makers.map((maker, index) => (
        <FadeIn key={maker.name} delayMs={Math.min(index, 4) * 60}>
          <Card style={styles.card}>
            <Text variant="heading">{maker.name}</Text>
            {maker.steps.map((step, stepIndex) => (
              <Text key={step} color="textSecondary">
                {`${stepIndex + 1}. ${step}`}
              </Text>
            ))}
          </Card>
        </FadeIn>
      ))}
      <Text variant="caption" color="textMuted">
        {de.battery.hint}
      </Text>
      <Button label={de.battery.openSettings} onPress={() => void Linking.openSettings()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.md },
  card: { gap: spacing.xs },
});
