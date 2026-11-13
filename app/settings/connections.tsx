import { router } from 'expo-router';
import { Linking, StyleSheet } from 'react-native';

import { Button, Card, Screen, Text } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { HealthCard } from '@/features/health/health-card';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Health Connect / Apple Health and the location permission for GPS runs. */
export default function ConnectionsScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <HealthCard timezone={profile.data?.timezone ?? DEFAULT_TIMEZONE} />
      <Card style={styles.card}>
        <Text variant="label" color="textSecondary">
          {de.connections.gpsLabel}
        </Text>
        <Text color="textSecondary">{de.connections.gpsText}</Text>
        <Button
          label={de.connections.openSettings}
          variant="secondary"
          onPress={() => void Linking.openSettings()}
        />
        <Button label={de.connections.startRun} onPress={() => router.push('/run/index')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: { gap: spacing.sm },
});
