import { StyleSheet } from 'react-native';

import { Screen } from '@/components';
import { PersistentCard } from '@/features/persistent/persistent-card';
import { PushCard } from '@/features/push/push-card';
import { ReminderCard } from '@/features/reminders/reminder-card';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

export default function NotificationSettingsScreen() {
  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <ReminderCard />
      <PersistentCard />
      <PushCard />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
});
