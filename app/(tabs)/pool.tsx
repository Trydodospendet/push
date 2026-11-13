import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges, usePoolOverview } from '@/features/challenges/api';
import { ChallengeSection } from '@/features/challenges/challenge-section';
import { isFinished, isPool } from '@/features/challenges/format';
import { de } from '@/i18n/de';
import { formatAmount } from '@/lib/money';
import { colors, spacing } from '@/theme';

/**
 * Pool: the overview of the whole app – how many people take part and how many credits are
 * bound in running goals. (Nobody can see who is running right now, so that is not shown.)
 */
export default function PoolScreen() {
  const router = useRouter();
  const session = useSession();
  const mine = useMyChallenges(session.user.id);
  const overview = usePoolOverview();

  const myPools = mine.data?.filter(isPool).filter((challenge) => !isFinished(challenge));

  const refresh = () => {
    void mine.refetch();
    void overview.refetch();
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={mine.isRefetching || overview.isRefetching}
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

      {overview.isPending ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState
          message={de.pool.error}
          onRetry={() => overview.refetch()}
          retrying={overview.isFetching}
        />
      ) : (
        <Card style={styles.numbers}>
          <View
            accessible
            accessibilityLabel={`${de.pool.boundLabel}: ${formatAmount(overview.data.boundCents)} ${de.common.credits}`}
          >
            <Text variant="label" color="textSecondary">
              {de.pool.boundLabel}
            </Text>
            <Text variant="display" color="accent" numberOfLines={1} adjustsFontSizeToFit>
              {formatAmount(overview.data.boundCents)}
            </Text>
            <Text variant="caption" color="textSecondary">
              {de.common.credits}
            </Text>
          </View>
          <View style={styles.row}>
            <View
              style={styles.fact}
              accessible
              accessibilityLabel={`${de.pool.peopleLabel}: ${overview.data.people}`}
            >
              <Text variant="label" color="textSecondary">
                {de.pool.peopleLabel}
              </Text>
              <Text variant="title">{overview.data.people}</Text>
            </View>
            <View
              style={styles.fact}
              accessible
              accessibilityLabel={`${de.pool.goalsLabel}: ${overview.data.goals}`}
            >
              <Text variant="label" color="textSecondary">
                {de.pool.goalsLabel}
              </Text>
              <Text variant="title">{overview.data.goals}</Text>
            </View>
          </View>
          <Text variant="caption" color="textMuted">
            {de.pool.hint}
          </Text>
        </Card>
      )}

      <View style={styles.group}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.pool.competitionsLabel}
        </Text>
        <Card style={styles.group}>
          {de.pool.competitions.map((line) => (
            <Text key={line} color="textSecondary">{`• ${line}`}</Text>
          ))}
          <Button
            label={de.pool.toRanked}
            variant="secondary"
            onPress={() => router.navigate('/ranked')}
          />
        </Card>
      </View>

      <View style={styles.group}>
        <Button
          label={de.challenges.joinByCode}
          variant="secondary"
          onPress={() => router.push('/challenge/join')}
        />
        <Text variant="caption" color="textMuted">
          {de.pool.codeHint}
        </Text>
      </View>

      {myPools && myPools.length > 0 ? (
        <ChallengeSection
          label={de.pool.mine}
          empty={{ icon: 'flag-outline', title: de.emptyStates.poolMineTitle, text: de.emptyStates.poolMineText }}
          errorText={de.pool.error}
          items={myPools.map((challenge) => ({
            challenge,
            joined: challenge.isParticipant,
            created: challenge.isCreator,
          }))}
          loading={mine.isPending}
          error={mine.isError}
          retrying={mine.isFetching}
          onRetry={() => void mine.refetch()}
        />
      ) : null}
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
  numbers: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fact: {
    flex: 1,
  },
  group: {
    gap: spacing.sm,
  },
});
