import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, ChipGroup, ErrorState, LoadingState, Text } from '@/components';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

import { usePeriodStats } from './analytics-api';
import { PeriodChart } from './charts';

/** Distance per week or month with a switch; the numbers come from the server. */
export function PeriodCard({ userId, onStart }: { userId: string; onStart: () => void }) {
  const [unit, setUnit] = useState<'week' | 'month'>('week');
  const stats = usePeriodStats(userId, unit);

  return (
    <Card style={styles.card}>
      <ChipGroup
        label={de.runStats.stats}
        options={[
          { value: 'week', label: de.runStats.week },
          { value: 'month', label: de.runStats.month },
        ]}
        value={unit}
        onChange={setUnit}
      />
      {stats.isPending ? (
        <LoadingState />
      ) : stats.isError ? (
        <ErrorState
          message={de.runStats.statsError}
          onRetry={() => stats.refetch()}
          retrying={stats.isFetching}
        />
      ) : stats.data.every((stat) => stat.runs === 0) ? (
        <>
          <Text color="textSecondary">{de.runStats.noRuns}</Text>
          <Button label={de.runStats.noRunsButton} onPress={onStart} />
        </>
      ) : (
        <PeriodChart stats={stats.data} unit={unit} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
});
