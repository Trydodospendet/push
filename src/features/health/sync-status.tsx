import { StyleSheet } from 'react-native';

import { Button, Card, Text } from '@/components';
import { de } from '@/i18n/de';
import { formatDateTime } from '@/lib/dates';
import { spacing } from '@/theme';

import { useHealth } from './health-provider';
import { healthSourceName } from './platform';

/** Time of the last successful sync, e.g. 'Zuletzt synchronisiert: 14.11.2026, 09:30'. */
export function useLastSyncText(timeZone: string): string {
  const { lastSyncAt, syncing } = useHealth();
  if (syncing) {
    return de.health.syncing;
  }
  return lastSyncAt === null
    ? de.health.neverSynced
    : de.health.lastSync(formatDateTime(new Date(lastSyncAt), timeZone));
}

/**
 * Shown while the phone is not connected or the last sync failed. Without the health data
 * the server cannot verify any progress, so this must stay visible.
 */
export function HealthBanner() {
  const { ready, connected, error, connect, sync, syncing } = useHealth();

  if (!ready || (connected && error === null)) {
    return null;
  }

  return (
    <Card style={styles.banner} accessibilityRole="alert">
      <Text>{connected ? (error ?? '') : de.health.banner(healthSourceName)}</Text>
      {error !== null && connected ? (
        <Button
          label={de.common.retry}
          variant="secondary"
          onPress={() => {
            void sync();
          }}
          loading={syncing}
        />
      ) : (
        <Button
          label={de.health.connect(healthSourceName)}
          variant="secondary"
          onPress={() => {
            void connect();
          }}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: spacing.sm,
  },
});
