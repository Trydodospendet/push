import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import {
  ChipGroup,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SettingsRow,
  Text,
} from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges, useOpenChallenges } from '@/features/challenges/api';
import { ChallengeCard } from '@/features/challenges/challenge-card';
import { ChallengeSection } from '@/features/challenges/challenge-section';
import { isFinished, isRanked, rankedCycle, type RankedCycle } from '@/features/challenges/format';
import type { Challenge } from '@/features/challenges/types';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

const CYCLES: readonly RankedCycle[] = ['day', 'week', 'month'];
const cycleOptions = CYCLES.map((value) => ({ value, label: de.challenges.cycleLabel[value] }));

/**
 * Ranked: fixed rankings (most km, most steps) per day, week and month – no stake, no payout –
 * plus friends and the league. Users can take part but not create their own rankings.
 */
export default function RankedScreen() {
  const router = useRouter();
  const session = useSession();
  const mine = useMyChallenges(session.user.id);
  const open = useOpenChallenges('ranked');
  const [cycle, setCycle] = useState<RankedCycle | null>(null);

  const myRanked = mine.data?.filter(isRanked);
  const myIds = new Set(myRanked?.filter((c) => c.isParticipant).map((c) => c.id));

  // Joinable ones plus the running ones I am part of, one entry per challenge.
  const current = new Map<string, Challenge>();
  for (const challenge of open.data ?? []) {
    current.set(challenge.id, challenge);
  }
  for (const challenge of myRanked ?? []) {
    if (!isFinished(challenge) && rankedCycle(challenge)) {
      current.set(challenge.id, challenge);
    }
  }
  const byCycle = (cycle: RankedCycle) =>
    [...current.values()]
      .filter((challenge) => rankedCycle(challenge)?.cycle === cycle)
      .sort(
        (a, b) =>
          a.starts_at.localeCompare(b.starts_at) ||
          (rankedCycle(a)?.metric ?? '').localeCompare(rankedCycle(b)?.metric ?? ''),
      );

  const selectedCycle = cycle ?? CYCLES.find((value) => byCycle(value).length > 0) ?? 'day';
  const items = byCycle(selectedCycle);
  const loading = mine.isPending || open.isPending;
  const failed = mine.isError || open.isError;
  const refresh = () => {
    void mine.refetch();
    void open.refetch();
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={mine.isRefetching || open.isRefetching}
          onRefresh={refresh}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.challenges.title}
        </Text>
        <Text color="textSecondary">{de.challenges.intro}</Text>
      </View>

      <SettingsRow
        icon="people-outline"
        label={de.social.homeButton}
        detail={de.social.rankedHint}
        onPress={() => router.push('/social')}
      />
      <ChipGroup
        label={de.challenges.rankingPeriod}
        options={cycleOptions}
        value={selectedCycle}
        onChange={setCycle}
      />

      {loading ? (
        <LoadingState />
      ) : failed ? (
        <ErrorState message={de.challenges.error} onRetry={refresh} retrying={mine.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title={de.emptyStates.rankedOpenTitle}
          text={de.emptyStates.rankedOpenText}
        />
      ) : (
        <View style={styles.group}>
          {items.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              joined={myIds.has(challenge.id)}
            />
          ))}
        </View>
      )}

      <ChallengeSection
        label={de.challenges.finished}
        empty={{
          icon: 'checkmark-done-outline',
          title: de.emptyStates.rankedFinishedTitle,
          text: de.emptyStates.rankedFinishedText,
        }}
        errorText={de.challenges.error}
        items={myRanked
          ?.filter((challenge) => challenge.isParticipant && isFinished(challenge))
          .reverse()
          .map((challenge) => ({ challenge, joined: true, created: false }))}
        loading={mine.isPending}
        error={mine.isError}
        retrying={mine.isFetching}
        onRetry={() => void mine.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  group: {
    gap: spacing.sm,
  },
});
