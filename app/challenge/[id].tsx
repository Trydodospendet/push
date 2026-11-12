import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, Share, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Pill, Screen, Sheet, Text } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import {
  useChallenge,
  useJoinChallenge,
  useLeaveChallenge,
  useParticipants,
} from '@/features/challenges/api';
import { ChallengeFacts } from '@/features/challenges/challenge-facts';
import {
  challengeDays,
  describeGoal,
  goalRule,
  isJoinable,
  statusLabel,
} from '@/features/challenges/format';
import { JoinSheet } from '@/features/challenges/join-sheet';
import type { Challenge, Participant } from '@/features/challenges/types';
import { de } from '@/i18n/de';
import { formatDayLabel } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/money';
import { colors, spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const challenge = useChallenge(id);
  const participants = useParticipants(id);

  if (challenge.isPending) {
    return (
      <Screen edges={SCREEN_EDGES}>
        <LoadingState />
      </Screen>
    );
  }

  if (challenge.isError || challenge.data === null) {
    return (
      <Screen edges={SCREEN_EDGES}>
        <ErrorState
          message={challenge.isError ? de.challenge.error : de.challenge.notFound}
          onRetry={challenge.isError ? () => challenge.refetch() : undefined}
          retrying={challenge.isFetching}
        />
      </Screen>
    );
  }

  return (
    <ChallengeDetail
      challenge={challenge.data}
      participants={participants.data ?? []}
      participantsLoading={participants.isPending}
      userId={session.user.id}
      refreshing={challenge.isRefetching || participants.isRefetching}
      onRefresh={() => {
        void challenge.refetch();
        void participants.refetch();
      }}
    />
  );
}

type ChallengeDetailProps = {
  challenge: Challenge;
  participants: Participant[];
  participantsLoading: boolean;
  userId: string;
  refreshing: boolean;
  onRefresh: () => void;
};

function ChallengeDetail({
  challenge,
  participants,
  participantsLoading,
  userId,
  refreshing,
  onRefresh,
}: ChallengeDetailProps) {
  const join = useJoinChallenge();
  const leave = useLeaveChallenge();
  const [sheet, setSheet] = useState<'join' | 'leave' | null>(null);

  const me = participants.find((participant) => participant.userId === userId);
  const isParticipant = me !== undefined;
  const isCreator = challenge.creator_id === userId;
  const joinable = isJoinable(challenge);
  const { firstDay } = challengeDays(challenge);

  const closeSheet = () => {
    setSheet(null);
    join.reset();
    leave.reset();
  };

  return (
    <Screen
      scroll
      edges={SCREEN_EDGES}
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.badges}>
          <Pill label={statusLabel(challenge.status)} />
          {isParticipant ? <Pill label={de.challenges.joinedBadge} tone="accent" /> : null}
        </View>
        <Text variant="title" accessibilityRole="header">
          {challenge.title}
        </Text>
        <Text variant="heading" color="textSecondary">
          {describeGoal(challenge.goal_type, challenge.target_value)}
        </Text>
      </View>

      <ChallengeFacts challenge={challenge} />

      {challenge.invite_code ? (
        <Card style={styles.inviteCard}>
          <Text variant="label" color="textSecondary">
            {de.challenge.inviteCode}
          </Text>
          <Text
            variant="title"
            selectable
            accessibilityLabel={challenge.invite_code.split('').join(' ')}
          >
            {challenge.invite_code}
          </Text>
          <Button
            label={de.challenge.shareCode}
            variant="secondary"
            onPress={() => {
              void Share.share({
                message: de.challenge.shareMessage(challenge.title, challenge.invite_code ?? ''),
              });
            }}
          />
        </Card>
      ) : null}

      {isParticipant ? (
        <View style={styles.section}>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {de.challenge.yourProgress}
          </Text>
          <Text color="textMuted">{de.challenge.progressPending}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.challenge.participantList}
        </Text>
        {participantsLoading ? (
          <LoadingState />
        ) : isParticipant ? (
          <Card style={styles.participants}>
            {participants.map((participant) => (
              <ParticipantRow
                key={participant.userId}
                participant={participant}
                isMe={participant.userId === userId}
              />
            ))}
          </Card>
        ) : (
          <Text color="textMuted">{de.challenge.participantsHidden}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.challenge.rules}
        </Text>
        {[
          goalRule(challenge.goal_type, challenge.target_value),
          de.challenge.ruleStart(formatDayLabel(firstDay)),
          de.challenge.ruleOnlyPeriod,
          de.challenge.ruleManual,
          de.challenge.ruleGrace(challenge.sync_grace_hours),
          de.challenge.ruleMinParticipants(challenge.min_participants),
          de.challenge.rulePayout,
          de.challenge.ruleNobody,
          de.challenge.ruleLeave,
        ].map((rule) => (
          <Text key={rule} color="textSecondary">
            {`• ${rule}`}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        {isCreator && !isParticipant && joinable ? (
          <Text variant="caption" color="textSecondary">
            {de.challenge.creatorHint}
          </Text>
        ) : null}
        {!isParticipant && joinable && !participantsLoading ? (
          <Button label={de.challenge.join} onPress={() => setSheet('join')} />
        ) : null}
        {!isParticipant && !joinable ? (
          <Text variant="caption" color="textMuted">
            {de.challenge.notJoinable}
          </Text>
        ) : null}
        {isParticipant && joinable ? (
          <Button
            label={de.challenge.leave}
            variant="secondary"
            onPress={() => setSheet('leave')}
          />
        ) : null}
      </View>

      <JoinSheet
        challenge={challenge}
        visible={sheet === 'join'}
        onClose={closeSheet}
        joining={join.isPending}
        error={join.isError ? toUserMessage(join.error) : null}
        onConfirm={() =>
          join.mutate({ challengeId: challenge.id }, { onSuccess: () => setSheet(null) })
        }
      />

      <Sheet
        visible={sheet === 'leave'}
        title={de.leaveSheet.title}
        onClose={closeSheet}
        closeLabel={de.leaveSheet.cancel}
      >
        <Text>{de.leaveSheet.text(formatAmount(me?.stakeCents ?? challenge.stake_cents))}</Text>
        {leave.isError ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {toUserMessage(leave.error)}
          </Text>
        ) : null}
        <View style={styles.section}>
          <Button
            label={de.leaveSheet.confirm}
            variant="secondary"
            loading={leave.isPending}
            onPress={() => leave.mutate(challenge.id, { onSuccess: () => setSheet(null) })}
          />
          <Button label={de.leaveSheet.cancel} onPress={closeSheet} />
        </View>
      </Sheet>
    </Screen>
  );
}

function resultLabel(result: string): string {
  switch (result) {
    case 'success':
      return de.challenge.resultDone;
    case 'failed':
      return de.challenge.resultFailed;
    case 'refunded':
      return de.challenge.resultRefunded;
    default:
      return de.challenge.resultOpen;
  }
}

function ParticipantRow({ participant, isMe }: { participant: Participant; isMe: boolean }) {
  const name = isMe ? `${participant.displayName} ${de.challenge.you}` : participant.displayName;
  const result = resultLabel(participant.result);
  return (
    <View style={styles.participantRow} accessible accessibilityLabel={`${name}: ${result}`}>
      <Text style={styles.participantName} numberOfLines={1}>
        {name}
      </Text>
      <Pill label={result} tone={participant.result === 'success' ? 'accent' : 'neutral'} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  inviteCard: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  participants: {
    gap: spacing.sm,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  participantName: {
    flex: 1,
  },
});
