import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges, useOpenChallenges } from '@/features/challenges/api';
import { ChallengeCard } from '@/features/challenges/challenge-card';
import { ChallengeSection } from '@/features/challenges/challenge-section';
import { RankedDemoPreview } from '@/features/challenges/ranked-demo-preview';
import { isFinished, isRanked, rankedCycle, type RankedCycle } from '@/features/challenges/format';
import type { Challenge } from '@/features/challenges/types';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

const CYCLES: readonly RankedCycle[] = ['day', 'week', 'month'];

/**
 * Ranked: fixed rankings (most km, most steps) per day, week and month – no stake, no payout –
 * plus friends and the league. Users can take part but not create their own rankings.
 */
export default function RankedScreen() {
  const router = useRouter();
  const session = useSession();
  const mine = useMyChallenges(session.user.id);
  const open = useOpenChallenges('ranked');

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

      <Card style={styles.social}>
        <Text variant="heading">{de.social.homeButton}</Text>
        <Text color="textSecondary">{de.social.rankedHint}</Text>
        <Button
          label={de.social.homeButton}
          variant="secondary"
          onPress={() => router.push('/social')}
        />
      </Card>

      {loading ? (
        <LoadingState />
      ) : failed ? (
        <ErrorState message={de.challenges.error} onRetry={refresh} retrying={mine.isFetching} />
      ) : current.size === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title={de.emptyStates.rankedOpenTitle}
          text={de.emptyStates.rankedOpenText}
        />
      ) : (
        CYCLES.map((cycle) => {
          const items = byCycle(cycle);
          return items.length === 0 ? null : (
            <View key={cycle} style={styles.group}>
              <Text variant="label" color="accent" accessibilityRole="header">
                {de.challenges.cycleLabel[cycle]}
              </Text>
              {items.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  joined={myIds.has(challenge.id)}
                />
              ))}
            </View>
          );
        })
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
      <RankedDemoPreview />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  social: {
    gap: spacing.sm,
  },
  group: {
    gap: spacing.sm,
  },
});
