import { Stack } from 'expo-router';

import { de } from '@/i18n/de';
import { colors, typography } from '@/theme';

export default function ChallengeLayout() {
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
      <Stack.Screen name="[id]" options={{ title: de.challenge.headerTitle }} />
      <Stack.Screen name="create" options={{ title: de.create.title }} />
      <Stack.Screen name="join" options={{ title: de.joinByCode.title }} />
    </Stack>
  );
}
