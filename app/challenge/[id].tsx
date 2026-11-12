import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, Share, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  ErrorState,
  LoadingState,
  Pill,
  Screen,
  Sheet,
  Text,
} from '@/components';
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
  formatFee,
  goalRule,
  isFinished,
  isJoinable,
  isSolo,
  modeLabel,
  statusLabel,
} from '@/features/challenges/format';
import { PotCard } from '@/features/challenges/pot-card';
import { JoinSheet } from '@/features/challenges/join-sheet';
import { Leaderboard } from '@/features/challenges/leaderboard';
import type { Challenge, Participant } from '@/features/challenges/types';
import { ActivityList } from '@/features/health/activity-list';
import { useMyProgress } from '@/features/health/api';
import { useHealth } from '@/features/health/health-provider';
import { ProgressSummary } from '@/features/health/progress-summary';
import { HealthBanner, useLastSyncText } from '@/features/health/sync-status';
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
  const health = useHealth();
  const progress = useMyProgress(userId);
  const lastSync = useLastSyncText(challenge.timezone);
  const [sheet, setSheet] = useState<'join' | 'leave' | null>(null);

  const me = participants.find((participant) => participant.userId === userId);
  const isParticipant = me !== undefined;
  const isCreator = challenge.creator_id === userId;
  const solo = isSolo(challenge);
  // A solo goal is joined when it is created; leaving it is final.
  const joinable = isJoinable(challenge) && !solo;
  const leavable = isJoinable(challenge);
  const showRanking =
    !solo &&
    (challenge.status === 'active' ||
      challenge.status === 'settling' ||
      challenge.status === 'settled');
  const { firstDay } = challengeDays(challenge);

  const rules = [
    goalRule(challenge.goal_type, challenge.target_value),
    de.challenge.ruleStart(formatDayLabel(firstDay)),
    de.challenge.ruleOnlyPeriod,
    de.challenge.ruleManual,
    de.challenge.ruleGrace(challenge.sync_grace_hours),
    ...(solo
      ? [de.challenge.ruleSoloWin, de.challenge.ruleSoloLose]
      : [
          de.challenge.ruleMinParticipants(challenge.min_participants),
          de.challenge.rulePayout,
          de.challenge.ruleAllWin,
          de.challenge.ruleNobody,
          ...(challenge.fee_bps > 0 ? [de.challenge.ruleFee(formatFee(challenge.fee_bps))] : []),
          de.challenge.ruleRounding,
          de.challenge.ruleRanking,
        ]),
    de.challenge.ruleLeave,
  ];

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
          refreshing={refreshing || health.syncing}
          onRefresh={() => {
            void health.sync().then(() => {
              onRefresh();
              void progress.refetch();
            });
          }}
          tintColor={colors.accent}
          colors={[colors.onAccent]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.badges}>
          <Pill label={modeLabel(challenge.mode)} />
          <Pill label={statusLabel(challenge.status)} />
          {isParticipant && !solo ? <Pill label={de.challenges.joinedBadge} tone="accent" /> : null}
        </View>
        <Text variant="title" accessibilityRole="header">
          {challenge.title}
        </Text>
        <Text variant="heading" color="textSecondary">
          {describeGoal(challenge.goal_type, challenge.target_value)}
        </Text>
      </View>

      {me && (isFinished(challenge) || challenge.status === 'settling') ? (
        <ResultCard challenge={challenge} me={me} />
      ) : null}

      <PotCard challenge={challenge} />

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
          {challenge.status === 'open' ? (
            <Text color="textMuted">{de.challenge.progressPending}</Text>
          ) : challenge.status === 'cancelled' ? (
            <Text color="textMuted">{de.challenge.progressCancelled}</Text>
          ) : (
            <>
              <HealthBanner />
              <ProgressSummary
                challenge={challenge}
                value={progress.data?.[challenge.id] ?? 0}
                now={new Date()}
                footer={health.connected ? lastSync : null}
              />
            </>
          )}
        </View>
      ) : null}

      {isParticipant && (challenge.status === 'active' || challenge.status === 'settling') ? (
        <ActivityList challenge={challenge} userId={userId} />
      ) : null}

      {solo ? null : (
        <View style={styles.section}>
          <Text variant="label" color="textSecondary" accessibilityRole="header">
            {showRanking && isParticipant ? de.challenge.ranking : de.challenge.participantList}
          </Text>
          {participantsLoading ? (
            <LoadingState />
          ) : !isParticipant ? (
            <Text color="textMuted">{de.challenge.participantsHidden}</Text>
          ) : showRanking ? (
            <Leaderboard challenge={challenge} />
          ) : (
            <Card style={styles.participants}>
              {participants.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                  isMe={participant.userId === userId}
                />
              ))}
            </Card>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.challenge.rules}
        </Text>
        {rules.map((rule) => (
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
        {!isParticipant && !joinable && !solo ? (
          <Text variant="caption" color="textMuted">
            {de.challenge.notJoinable}
          </Text>
        ) : null}
        {isParticipant && leavable ? (
          <Button
            label={de.challenge.leave}
            variant="secondary"
            onPress={() => setSheet('leave')}
          />
        ) : null}
      </View>

      <JoinSheet
        stakeCents={challenge.stake_cents}
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

/** Own result: waiting for the settlement, won (with payout), lost or refunded. */
function ResultCard({ challenge, me }: { challenge: Challenge; me: Participant }) {
  let title: string;
  let text: string | null = null;
  if (challenge.status === 'settling') {
    title = de.challenge.resultPending;
  } else if (challenge.status === 'cancelled' || me.result === 'refunded') {
    title = de.challenge.resultCancelled;
    text = de.challenge.resultRefundText(formatAmount(me.payoutCents ?? me.stakeCents));
  } else if (me.result === 'success') {
    title = de.challenge.resultWon;
    text = de.challenge.resultWonPayout(formatAmount(me.payoutCents ?? 0));
  } else {
    title = de.challenge.resultLost;
    text = de.challenge.resultLostText;
  }
  const won = challenge.status === 'settled' && me.result === 'success';

  return (
    <Card style={styles.result}>
      <Text variant="label" color="textSecondary" accessibilityRole="header">
        {de.challenge.result}
      </Text>
      <Text variant="heading" color={won ? 'accent' : 'text'}>
        {title}
      </Text>
      {text ? <Text color="textSecondary">{text}</Text> : null}
    </Card>
  );
}

function ParticipantRow({ participant, isMe }: { participant: Participant; isMe: boolean }) {
  const name = isMe ? `${participant.displayName} ${de.challenge.you}` : participant.displayName;
  const result = resultLabel(participant.result);
  return (
    <View style={styles.participantRow} accessible accessibilityLabel={`${name}: ${result}`}>
      <Avatar name={participant.displayName} size="sm" highlight={isMe} />
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
  result: {
    gap: spacing.xs,
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
