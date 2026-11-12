import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges, useOpenChallenges } from '@/features/challenges/api';
import { ChallengeCard } from '@/features/challenges/challenge-card';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

export default function ChallengesScreen() {
  const router = useRouter();
  const session = useSession();
  const mine = useMyChallenges(session.user.id);
  const open = useOpenChallenges();

  const refreshing = mine.isRefetching || open.isRefetching;
  const refresh = () => {
    void mine.refetch();
    void open.refetch();
  };

  const myIds = new Set(mine.data?.filter((c) => c.isParticipant).map((c) => c.id));
  const createdIds = new Set(mine.data?.filter((c) => c.isCreator).map((c) => c.id));
  const myActive = mine.data?.filter((c) => c.status !== 'settled' && c.status !== 'cancelled');

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
      <Text variant="title" accessibilityRole="header">
        {de.challenges.title}
      </Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label={de.challenges.create} onPress={() => router.push('/challenge/create')} />
        </View>
        <View style={styles.action}>
          <Button
            label={de.challenges.joinByCode}
            variant="secondary"
            onPress={() => router.push('/challenge/join')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.challenges.mine}
        </Text>
        {mine.isPending ? (
          <LoadingState />
        ) : mine.isError ? (
          <ErrorState
            message={de.challenges.error}
            onRetry={() => mine.refetch()}
            retrying={mine.isFetching}
          />
        ) : myActive && myActive.length > 0 ? (
          myActive.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              joined={challenge.isParticipant}
              created={challenge.isCreator}
            />
          ))
        ) : (
          <Text color="textMuted">{de.challenges.emptyMine}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.challenges.open}
        </Text>
        {open.isPending ? (
          <LoadingState />
        ) : open.isError ? (
          <ErrorState
            message={de.challenges.error}
            onRetry={() => open.refetch()}
            retrying={open.isFetching}
          />
        ) : open.data.length > 0 ? (
          open.data.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              joined={myIds.has(challenge.id)}
              created={createdIds.has(challenge.id)}
            />
          ))
        ) : (
          <Text color="textMuted">{de.challenges.emptyOpen}</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
});
