import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { APP_NAME } from '@/config/app';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

export default function WelcomeScreen() {
  // Navigation to the sign-in screen is wired up in Phase 1 (account).
  const handleStart = () => undefined;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text variant="display" accessibilityRole="header" accessibilityLabel={APP_NAME}>
          {de.welcome.logo}
        </Text>
        <Text variant="label" color="textSecondary">
          {de.welcome.claim}
        </Text>
      </View>
      <Button label={de.welcome.start} onPress={handleStart} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.lg,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
