import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyChallenges } from '@/features/challenges/api';
import { ChallengeSection } from '@/features/challenges/challenge-section';
import { isFinished, isSolo } from '@/features/challenges/format';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

/** Solo: personal goals with a stake on yourself. */
export default function SoloScreen() {
  const router = useRouter();
  const session = useSession();
  const mine = useMyChallenges(session.user.id);

  const solo = mine.data?.filter((challenge) => isSolo(challenge) && challenge.isParticipant);
  const state = {
    errorText: de.solo.error,
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
          refreshing={mine.isRefetching}
          onRefresh={() => void mine.refetch()}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.solo.title}
        </Text>
        <Text color="textSecondary">{de.solo.intro}</Text>
      </View>
      <Button
        label={de.solo.create}
        onPress={() => router.push({ pathname: '/challenge/create', params: { mode: 'solo' } })}
      />

      <ChallengeSection
        label={de.solo.current}
        empty={{
          icon: 'flag-outline',
          title: de.emptyStates.soloCurrentTitle,
          text: de.emptyStates.soloCurrentText,
        }}
        items={solo
          ?.filter((challenge) => !isFinished(challenge))
          .map((challenge) => ({ challenge, joined: true, created: true }))}
        {...state}
      />

      <ChallengeSection
        label={de.solo.finished}
        empty={{
          icon: 'checkmark-done-outline',
          title: de.emptyStates.soloFinishedTitle,
          text: de.emptyStates.soloFinishedText,
        }}
        items={solo
          ?.filter(isFinished)
          .reverse()
          .map((challenge) => ({ challenge, joined: true, created: true }))}
        {...state}
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
});
