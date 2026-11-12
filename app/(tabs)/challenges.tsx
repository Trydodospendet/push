import { StyleSheet } from 'react-native';

import { Screen, Text } from '@/components';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

/** Placeholder until phase 2 (discover challenges). */
export default function ChallengesScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <Text variant="title" accessibilityRole="header">
        {de.challenges.title}
      </Text>
      <Text color="textSecondary">{de.challenges.placeholder}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    gap: spacing.xs,
  },
});
