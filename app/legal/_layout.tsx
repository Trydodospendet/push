import { Stack } from 'expo-router';

import { de } from '@/i18n/de';
import { colors, typography } from '@/theme';

/** Privacy policy and imprint, reachable signed in and signed out. */
export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { ...typography.button },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="privacy" options={{ title: de.legal.privacyTitle }} />
      <Stack.Screen name="imprint" options={{ title: de.legal.imprintTitle }} />
    </Stack>
  );
}
