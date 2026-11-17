import { ScreenHeaderContext } from '@/components/screen';
import { GoalHeader } from '@/features/challenges/goal-header';
import { Tabs } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components';
import { FurIcon } from '@/features/fur/fur-icon';
import { WinCelebration } from '@/features/stats/win-celebration';
import { de } from '@/i18n/de';
import { colors, glow, layout, typography } from '@/theme';

/** Soft lime halo behind the icon of the selected tab. */
function TabGlow({ focused, children }: { focused: boolean; children: ReactNode }) {
  return <View style={[styles.tabIcon, focused && styles.tabIconActive]}>{children}</View>;
}

function furTab(name: 'home' | 'shoe' | 'trophy') {
  return function FurTabIcon({ focused }: { focused: boolean }) {
    return (
      <TabGlow focused={focused}>
        <FurIcon name={name} size={28} dim={!focused} />
      </TabGlow>
    );
  };
}

function tabIcon(name: IconName, focusedName: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return (
      <TabGlow focused={focused}>
        <Icon name={focused ? focusedName : name} color={focused ? 'text' : 'textMuted'} />
      </TabGlow>
    );
  };
}

const styles = StyleSheet.create({
  tabIcon: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  tabIconActive: {
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 14, spreadDistance: 2, color: glow.soft }],
  },
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <ScreenHeaderContext.Provider value={true}>
      <Tabs
        screenOptions={{
          headerShown: true,
          header: () => <GoalHeader />,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { ...typography.caption, fontFamily: typography.button.fontFamily },
          tabBarItemStyle: { minHeight: layout.minTouchTarget },
          tabBarStyle: {
            height: layout.tabBarHeight + insets.bottom,
            paddingBottom: insets.bottom,
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
            tabBarIcon: furTab('home'),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: de.improvements.running,
            tabBarAccessibilityLabel: de.tabs.activity,
            tabBarIcon: furTab('shoe'),
          }}
        />
        <Tabs.Screen
          name="ranked"
          options={{
            title: de.tabs.ranked,
            tabBarAccessibilityLabel: de.tabs.ranked,
            tabBarIcon: furTab('trophy'),
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
