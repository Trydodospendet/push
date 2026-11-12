import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { ChallengeCard } from '@/features/challenges/challenge-card';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

/** Phase 2: the challenges the user joined. Progress (big number + bar) follows in phase 3. */
export default function HomeScreen() {
  const router = useRouter();
  const session = useSession();
  const mine = useMyChallenges(session.user.id);
  const joined = mine.data?.filter(
    (challenge) =>
      challenge.isParticipant && challenge.status !== 'settled' && challenge.status !== 'cancelled',
  );

  if (mine.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (mine.isError) {
    return (
      <Screen>
        <ErrorState
          message={de.home.error}
          onRetry={() => mine.refetch()}
          retrying={mine.isFetching}
        />
      </Screen>
    );
  }

  if (!joined || joined.length === 0) {
    return (
      <Screen contentStyle={styles.emptyContent}>
        <Text variant="label" color="textSecondary">
          {de.home.label}
        </Text>
        <View style={styles.empty}>
          <Text variant="title" accessibilityRole="header">
            {de.home.emptyTitle}
          </Text>
          <Text color="textSecondary">{de.home.emptyText}</Text>
        </View>
        <Button label={de.home.findChallenge} onPress={() => router.navigate('/challenges')} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={mine.isRefetching}
          onRefresh={() => {
            void mine.refetch();
          }}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.home.label}
      </Text>
      {joined.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} joined />
      ))}
      <Text variant="caption" color="textMuted">
        {de.home.progressHint}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
});
