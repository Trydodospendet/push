import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components';
import { WinCelebration } from '@/features/stats/win-celebration';
import { de } from '@/i18n/de';
import { colors, layout, typography } from '@/theme';

function tabIcon(name: IconName, focusedName: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={focused ? focusedName : name} color={focused ? 'text' : 'textMuted'} />;
  };
}

export default function TabsLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { ...typography.caption, fontFamily: typography.button.fontFamily },
          tabBarItemStyle: { minHeight: layout.minTouchTarget },
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            borderTopWidth: layout.borderWidth,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: de.tabs.home,
            tabBarAccessibilityLabel: de.tabs.home,
            tabBarIcon: tabIcon('home-outline', 'home'),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: de.improvements.running,
            tabBarAccessibilityLabel: de.tabs.activity,
            tabBarIcon: tabIcon('walk-outline', 'walk'),
          }}
        />
        <Tabs.Screen
          name="ranked"
          options={{
            title: de.tabs.ranked,
            tabBarAccessibilityLabel: de.tabs.ranked,
            tabBarIcon: tabIcon('trophy-outline', 'trophy'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: de.tabs.profile,
            tabBarAccessibilityLabel: de.tabs.profile,
            tabBarIcon: tabIcon('person-outline', 'person'),
          }}
        />
      </Tabs>
      <WinCelebration />
    </>
  );
}
