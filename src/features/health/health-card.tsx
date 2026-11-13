import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Text } from '@/components';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

import { useHealth } from './health-provider';
import { healthSourceName } from './platform';
import { useLastSyncText } from './sync-status';

export function HealthCard({ timezone }: { timezone: string }) {
  const health = useHealth();
  const lastSync = useLastSyncText(timezone);
  const [connecting, setConnecting] = useState(false);

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.health.statusLabel}
      </Text>
      <Text>
        {health.connected
          ? de.health.connected(healthSourceName)
          : de.health.notConnected(healthSourceName)}
      </Text>
      {health.connected ? (
        <Text variant="caption" color="textMuted">
          {lastSync}
        </Text>
      ) : null}
      {health.error !== null ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {health.error}
        </Text>
      ) : null}
      {health.connected ? (
        <Button
          label={de.health.syncNow}
          variant="secondary"
          loading={health.syncing}
          onPress={() => void health.sync()}
        />
      ) : null}
      <Button
        label={health.connected ? de.health.reconnect : de.health.connect(healthSourceName)}
        variant="secondary"
        loading={connecting}
        onPress={() => {
          setConnecting(true);
          void health.connect().finally(() => setConnecting(false));
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xxs,
  },
});
