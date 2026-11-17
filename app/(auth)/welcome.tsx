import { useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { Button, FadeIn, GlowBackdrop, Screen, Text } from '@/components';
import { furImages } from '@/features/fur/images';
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
          <Image
            source={furImages.push}
            accessible
            accessibilityRole="header"
            accessibilityLabel={APP_NAME}
            resizeMode="contain"
            style={styles.logo}
          />
        </FadeIn>
        <FadeIn delayMs={250} durationMs={700}>
          <Text variant="label" color="textSecondary">
            {de.welcome.claim}
          </Text>
        </FadeIn>
      </View>
      <FadeIn delayMs={500}>
        <View style={styles.actions}>
          <Button label={de.welcome.signUp} onPress={() => router.push('/sign-up')} />
          <Button
            label={de.welcome.signIn}
            variant="secondary"
            onPress={() => router.push('/sign-in')}
          />
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
  logo: { width: 260, height: 78 },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
