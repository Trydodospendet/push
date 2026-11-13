import { Stack } from 'expo-router';

import { de } from '@/i18n/de';
import { colors, typography } from '@/theme';

export default function SettingsLayout() {
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
      <Stack.Screen name="account" options={{ title: de.account.title }} />
      <Stack.Screen name="privacy" options={{ title: de.privacySettings.title }} />
      <Stack.Screen name="notifications" options={{ title: de.notificationSettings.title }} />
      <Stack.Screen name="donations" options={{ title: de.donationSettings.title }} />
      <Stack.Screen name="connections" options={{ title: de.connections.title }} />
      <Stack.Screen name="appearance" options={{ title: de.appearance.title }} />
      <Stack.Screen name="data" options={{ title: de.dataSettings.title }} />
    </Stack>
  );
}
