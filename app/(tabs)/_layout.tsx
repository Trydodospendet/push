import { Tabs } from 'expo-router';

import { de } from '@/i18n/de';
import { colors, layout, typography } from '@/theme';

/**
 * Text-only tabs for now: icons need an icon library, which is not part of the approved
 * dependencies yet (see docs/SETUP.md, open points).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { ...typography.button, fontSize: 14 },
        tabBarItemStyle: { justifyContent: 'center', minHeight: layout.minTouchTarget },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: layout.borderWidth,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: de.tabs.home, tabBarAccessibilityLabel: de.tabs.home }}
      />
      <Tabs.Screen
        name="challenges"
        options={{ title: de.tabs.challenges, tabBarAccessibilityLabel: de.tabs.challenges }}
      />
      <Tabs.Screen
        name="wallet"
        options={{ title: de.tabs.wallet, tabBarAccessibilityLabel: de.tabs.wallet }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: de.tabs.profile, tabBarAccessibilityLabel: de.tabs.profile }}
      />
    </Tabs>
  );
}
