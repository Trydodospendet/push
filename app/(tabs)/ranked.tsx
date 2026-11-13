import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges, useOpenChallenges } from '@/features/challenges/api';
import { ChallengeSection } from '@/features/challenges/challenge-section';
import { ChallengeCard } from '@/features/challenges/challenge-card';
import { isFinished, isSolo, isWeekly } from '@/features/challenges/format';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

/** Ranked: shared pools against other people. */
export default function RankedScreen() {
  const router = useRouter();
  const session = useSession();
  const mine = useMyChallenges(session.user.id);
  const open = useOpenChallenges();

  const refreshing = mine.isRefetching || open.isRefetching;
  const refresh = () => {
    void mine.refetch();
    void open.refetch();
  };

  const myRanked = mine.data?.filter((challenge) => !isSolo(challenge));
  const myIds = new Set(myRanked?.filter((c) => c.isParticipant).map((c) => c.id));
  const createdIds = new Set(myRanked?.filter((c) => c.isCreator).map((c) => c.id));
  // The weekly challenge: the one people can still join, otherwise the one I am part of.
  const weekly =
    open.data?.find(isWeekly) ??
    myRanked?.find((challenge) => isWeekly(challenge) && !isFinished(challenge));
  const notWeekly = <T extends { id: string }>(challenge: T) => challenge.id !== weekly?.id;
  const toItem = (challenge: { id: string }) => ({
    joined: myIds.has(challenge.id),
    created: createdIds.has(challenge.id),
  });

  const mineState = {
    loading: mine.isPending,
    error: mine.isError,
    retrying: mine.isFetching,
    onRetry: () => void mine.refetch(),
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
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
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label={de.challenges.create}
            onPress={() =>
              router.push({ pathname: '/challenge/create', params: { mode: 'ranked' } })
            }
          />
        </View>
        <View style={styles.action}>
          <Button
            label={de.challenges.joinByCode}
            variant="secondary"
            onPress={() => router.push('/challenge/join')}
          />
        </View>
      </View>

      {weekly ? (
        <View style={styles.weekly}>
          <Text variant="label" color="accent" accessibilityRole="header">
            {de.challenges.weekly}
          </Text>
          <ChallengeCard challenge={weekly} featured {...toItem(weekly)} />
          <Text variant="caption" color="textMuted">
            {de.challenges.weeklyHint}
          </Text>
        </View>
      ) : null}

      <ChallengeSection
        label={de.challenges.mine}
        empty={{
          icon: 'trophy-outline',
          title: de.emptyStates.rankedMineTitle,
          text: de.emptyStates.rankedMineText,
        }}
        errorText={de.challenges.error}
        items={myRanked
          ?.filter((challenge) => !isFinished(challenge) && notWeekly(challenge))
          .map((challenge) => ({ challenge, ...toItem(challenge) }))}
        {...mineState}
      />

      <ChallengeSection
        label={de.challenges.open}
        empty={{
          icon: 'search-outline',
          title: de.emptyStates.rankedOpenTitle,
          text: de.emptyStates.rankedOpenText,
        }}
        errorText={de.challenges.error}
        items={open.data
          ?.filter(notWeekly)
          .map((challenge) => ({ challenge, ...toItem(challenge) }))}
        loading={open.isPending}
        error={open.isError}
        retrying={open.isFetching}
        onRetry={() => void open.refetch()}
      />

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
          .map((challenge) => ({ challenge, ...toItem(challenge) }))}
        {...mineState}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  weekly: {
    gap: spacing.xs,
  },
  header: {
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
