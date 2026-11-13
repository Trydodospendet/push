import { StyleSheet, View } from 'react-native';

import { Card, ErrorState, LoadingState, Text } from '@/components';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

import { useMyRecords, type PersonalRecord } from './analytics-api';
import { formatKm, formatPace } from './format';

function valueText(record: PersonalRecord): string {
  return record.kind === 'longest_run' || record.kind === 'best_week'
    ? de.runStats.recordValueKm(formatKm(record.value))
    : de.runStats.recordValuePace(formatPace(record.value));
}

/** Longest run, fastest paces and best week – the numbers come from the server. */
export function RecordsCard({ userId }: { userId: string }) {
  const records = useMyRecords(userId);

  if (records.isPending) {
    return <LoadingState />;
  }
  if (records.isError) {
    return (
      <ErrorState
        message={de.runStats.recordsError}
        onRetry={() => records.refetch()}
        retrying={records.isFetching}
      />
    );
  }

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.runStats.records}
      </Text>
      {records.data.length === 0 ? (
        <Text color="textMuted">{de.runStats.recordsEmpty}</Text>
      ) : (
        records.data.map((record) => (
          <View
            key={record.kind}
            style={styles.row}
            accessible
            accessibilityLabel={`${de.runStats.recordLabel[record.kind]}: ${valueText(record)}`}
          >
            <Text color="textSecondary" style={styles.label}>
              {de.runStats.recordLabel[record.kind]}
            </Text>
            <Text variant="heading" style={styles.value}>
              {valueText(record)}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
});
