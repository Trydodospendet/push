import { Stack } from 'expo-router';

import { de } from '@/i18n/de';
import { colors, typography } from '@/theme';

export default function ActivityLayout() {
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
      <Stack.Screen name="[recordId]" options={{ title: de.activityTab.routeTitle }} />
    </Stack>
  );
}
