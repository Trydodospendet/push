import { StyleSheet, View } from 'react-native';

import { Art, Button, Card, FadeIn, GlowBackdrop, Screen, Text } from '@/components';
import { healthSourceName } from '@/features/health/platform';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

/** The long version of "how it works": every step with its own picture. */
export function Guide({ onBack }: { onBack: () => void }) {
  const steps = de.guide.steps(healthSourceName);

  return (
    <Screen scroll contentStyle={styles.content}>
      <GlowBackdrop />
      <FadeIn style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.guide.title}
        </Text>
        <Text color="textSecondary">{de.guide.intro}</Text>
      </FadeIn>
      {steps.map((step, index) => (
        <FadeIn key={step.title} delayMs={Math.min(index, 4) * 80}>
          <Card
            style={styles.step}
            accessible
            accessibilityLabel={`${de.guide.step(index + 1)}. ${step.title}. ${step.text}`}
          >
            <View style={styles.art}>
              <Art name={step.art} size={132} />
            </View>
            <Text variant="label" color="accent">
              {de.guide.step(index + 1)}
            </Text>
            <Text variant="heading">{step.title}</Text>
            <Text color="textSecondary">{step.text}</Text>
          </Card>
        </FadeIn>
      ))}
      <Text variant="caption" color="textMuted">
        {de.guide.testPhase}
      </Text>
      <Button label={de.guide.back} onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  step: {
    gap: spacing.xs,
  },
  art: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
