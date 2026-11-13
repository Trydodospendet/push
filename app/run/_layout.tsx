import { Stack } from 'expo-router';

import { de } from '@/i18n/de';
import { colors, typography } from '@/theme';

/** The map lies behind the whole screen, so the header floats transparently over it. */
export default function RunLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerTintColor: colors.text,
        headerTitleStyle: { ...typography.button },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: de.run.title }} />
      <Stack.Screen name="[id]" options={{ title: de.run.headerTitle }} />
    </Stack>
  );
}
