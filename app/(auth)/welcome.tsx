import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, FadeIn, GlowBackdrop, Screen, Text } from '@/components';
import { APP_NAME } from '@/config/app';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <GlowBackdrop size={520} intensity={0.28} />
      <View style={styles.hero}>
        <FadeIn rise={24} durationMs={700}>
          <Text variant="display" accessibilityRole="header" accessibilityLabel={APP_NAME}>
            {de.welcome.logo}
          </Text>
        </FadeIn>
        <FadeIn delayMs={250} durationMs={700}>
          <Text variant="label" color="textSecondary">
            {de.welcome.claim}
          </Text>
        </FadeIn>
      </View>
      <FadeIn delayMs={500}>
        <Button label={de.welcome.start} onPress={() => router.push('/sign-in')} />
      </FadeIn>
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
