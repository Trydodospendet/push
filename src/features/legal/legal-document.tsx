import { StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components';
import type { LegalSection } from '@/i18n/de';
import { spacing } from '@/theme';

/** Static legal page (privacy policy, imprint). The texts live in src/i18n/de.ts. */
export function LegalDocument({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <Screen scroll edges={['bottom', 'left', 'right']} contentStyle={styles.content}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text variant="heading" accessibilityRole="header">
            {section.title}
          </Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} color="textSecondary">
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.xs,
  },
});
