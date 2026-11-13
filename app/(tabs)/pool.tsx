import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges, useOpenChallenges } from '@/features/challenges/api';
import { ChallengeSection } from '@/features/challenges/challenge-section';
import { isFinished, isPool } from '@/features/challenges/format';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

/** Pool: one pot, everybody pays an own stake; those who reach the goal share the pot. */
export default function PoolScreen() {
  const router = useRouter();
  const session = useSession();
  const mine = useMyChallenges(session.user.id);
  const open = useOpenChallenges('pool');

  const refreshing = mine.isRefetching || open.isRefetching;
  const refresh = () => {
    void mine.refetch();
    void open.refetch();
  };

  const myPools = mine.data?.filter(isPool);
  const joinedIds = new Set(myPools?.filter((c) => c.isParticipant).map((c) => c.id));
  const createdIds = new Set(myPools?.filter((c) => c.isCreator).map((c) => c.id));
  const toItem = (challenge: { id: string }) => ({
    joined: joinedIds.has(challenge.id),
    created: createdIds.has(challenge.id),
  });
  const mineState = {
    errorText: de.pool.error,
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
          {de.pool.title}
        </Text>
        <Text color="textSecondary">{de.pool.intro}</Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label={de.pool.create}
            onPress={() => router.push({ pathname: '/challenge/create', params: { mode: 'pool' } })}
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

      <ChallengeSection
        label={de.pool.mine}
        empty={{
          icon: 'flag-outline',
          title: de.emptyStates.poolMineTitle,
          text: de.emptyStates.poolMineText,
        }}
        items={myPools
          ?.filter((challenge) => !isFinished(challenge))
          .map((challenge) => ({ challenge, ...toItem(challenge) }))}
        {...mineState}
      />

      <ChallengeSection
        label={de.pool.open}
        empty={{
          icon: 'search-outline',
          title: de.emptyStates.poolOpenTitle,
          text: de.emptyStates.poolOpenText,
        }}
        errorText={de.pool.error}
        items={open.data
          ?.filter((challenge) => !joinedIds.has(challenge.id))
          .map((challenge) => ({ challenge, ...toItem(challenge) }))}
        loading={open.isPending}
        error={open.isError}
        retrying={open.isFetching}
        onRetry={() => void open.refetch()}
      />

      <ChallengeSection
        label={de.pool.finished}
        empty={{
          icon: 'checkmark-done-outline',
          title: de.emptyStates.poolFinishedTitle,
          text: de.emptyStates.poolFinishedText,
        }}
        items={myPools
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
