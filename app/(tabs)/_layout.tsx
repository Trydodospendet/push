import { ScreenHeaderContext } from '@/components/screen';
import { GoalHeader } from '@/features/challenges/goal-header';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components';
import { WinCelebration } from '@/features/stats/win-celebration';
import { de } from '@/i18n/de';
import { colors, layout, typography } from '@/theme';

/** Clean line icon: lime when selected, grey otherwise. */
function tabIcon(name: IconName, focusedName: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={focused ? focusedName : name} color={focused ? 'accent' : 'tabInactive'} />;
  };
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <ScreenHeaderContext.Provider value={true}>
      <Tabs
        screenOptions={{
          headerShown: true,
          header: () => <GoalHeader />,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarLabelStyle: { ...typography.caption, fontFamily: typography.button.fontFamily },
          tabBarItemStyle: { minHeight: layout.minTouchTarget },
          tabBarStyle: {
            height: layout.tabBarHeight + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
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
            tabBarIcon: tabIcon('pulse-outline', 'pulse'),
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
    </ScreenHeaderContext.Provider>
  );
}
