import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  ErrorState,
  FadeIn,
  Icon,
  LoadingState,
  Pill,
  Screen,
  Sheet,
  Text,
  TextField,
} from '@/components';
import { LEGAL } from '@/config/app';
import { formatClock, formatKm } from '@/features/gps/format';
import {
  inviteLink,
  useAddComment,
  useCreateGroup,
  useDeleteComment,
  useFriendCode,
  useFriendRequests,
  useFriendRuns,
  useFriends,
  useGiveKudos,
  useGroupBoard,
  useGroups,
  useJoinGroup,
  useLeaveGroup,
  useRemoveFriend,
  useRespondFriendRequest,
  useRunComments,
  useSeasonBoard,
  useSendFriendRequest,
  type FriendRun,
  type Group,
} from '@/features/social/api';
import { hapticSuccess } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { colors, layout, radius, spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Friends (invite, requests, runs with kudos and comments), groups with a board, the league. */
export default function SocialScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <Stack.Screen options={{ title: de.social.title }} />
      <FadeIn style={styles.section}>
        <InviteCard />
        <AddFriend initialCode={code ?? ''} />
        <Requests />
      </FadeIn>
      <FadeIn delayMs={80} style={styles.section}>
        <FriendRuns />
      </FadeIn>
      <FadeIn delayMs={120} style={styles.section}>
        <Friends />
      </FadeIn>
      <FadeIn delayMs={160} style={styles.section}>
        <Groups />
      </FadeIn>
      <FadeIn delayMs={200} style={styles.section}>
        <League />
      </FadeIn>
    </Screen>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="label" color="textSecondary" accessibilityRole="header">
      {children}
    </Text>
  );
}

function InviteCard() {
  const code = useFriendCode();
  return (
    <Card style={styles.card}>
      <SectionTitle>{de.social.inviteLabel}</SectionTitle>
      {code.isPending ? (
        <LoadingState />
      ) : code.isError ? (
        <ErrorState
          message={de.social.error}
          onRetry={() => code.refetch()}
          retrying={code.isFetching}
        />
      ) : (
        <>
          <Text variant="title" selectable accessibilityLabel={code.data.split('').join(' ')}>
            {code.data}
          </Text>
          <Text variant="caption" color="textMuted">
            {de.social.inviteHint}
          </Text>
          <Button
            label={de.social.inviteShare}
            variant="secondary"
            onPress={() =>
              void Share.share({
                message: de.social.inviteMessage(inviteLink(code.data), code.data),
              })
            }
          />
        </>
      )}
    </Card>
  );
}

function AddFriend({ initialCode }: { initialCode: string }) {
  const send = useSendFriendRequest();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [result, setResult] = useState<'pending' | 'accepted' | null>(null);
  return (
    <Card style={styles.card}>
      <TextField
        label={de.social.addLabel}
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        error={send.isError ? toUserMessage(send.error) : null}
      />
      {result ? (
        <Text color="accent" accessibilityLiveRegion="polite">
          {result === 'accepted' ? de.social.nowFriends : de.social.requestSent}
        </Text>
      ) : null}
      <Button
        label={de.social.addButton}
        loading={send.isPending}
        disabled={code.length < 8}
        onPress={() =>
          send.mutate(code, {
            onSuccess: (data) => {
              setResult(data === 'accepted' ? 'accepted' : 'pending');
              setCode('');
              hapticSuccess();
            },
          })
        }
      />
    </Card>
  );
}

function Requests() {
  const requests = useFriendRequests();
  const respond = useRespondFriendRequest();
  if (!requests.data || requests.data.length === 0) {
    return null;
  }
  return (
    <Card style={styles.card}>
      <SectionTitle>{de.social.requestsLabel}</SectionTitle>
      {requests.data.map((request) => (
        <View key={request.id} style={styles.row}>
          <Text style={styles.grow}>{request.displayName}</Text>
          <Button
            label={de.social.accept}
            onPress={() => respond.mutate({ id: request.id, accept: true })}
          />
          <Button
            label={de.social.decline}
            variant="secondary"
            onPress={() => respond.mutate({ id: request.id, accept: false })}
          />
        </View>
      ))}
    </Card>
  );
}

function Friends() {
  const friends = useFriends();
  const remove = useRemoveFriend();
  return (
    <>
      <SectionTitle>{de.social.friendsLabel}</SectionTitle>
      {friends.isPending ? (
        <LoadingState />
      ) : friends.isError ? (
        <ErrorState
          message={de.social.error}
          onRetry={() => friends.refetch()}
          retrying={friends.isFetching}
        />
      ) : friends.data.length === 0 ? (
        <Text color="textMuted">{de.social.friendsEmpty}</Text>
      ) : (
        friends.data.map((friend) => (
          <View key={friend.userId} style={styles.row}>
            <Text style={styles.grow}>{friend.displayName}</Text>
            <Button
              label={de.social.remove}
              variant="secondary"
              accessibilityLabel={`${de.social.remove}: ${friend.displayName}`}
              onPress={() => remove.mutate(friend.userId)}
            />
          </View>
        ))
      )}
    </>
  );
}

function FriendRuns() {
  const runs = useFriendRuns();
  const kudos = useGiveKudos();
  const [open, setOpen] = useState<FriendRun | null>(null);
  return (
    <>
      <SectionTitle>{de.social.runsLabel}</SectionTitle>
      {runs.isPending ? (
        <LoadingState />
      ) : runs.isError ? (
        <ErrorState
          message={de.social.error}
          onRetry={() => runs.refetch()}
          retrying={runs.isFetching}
        />
      ) : runs.data.length === 0 ? (
        <Text color="textMuted">{de.social.runsEmpty}</Text>
      ) : (
        runs.data.map((run) => (
          <Card key={run.workoutId} style={styles.card}>
            <Text variant="heading">
              {`${run.isMine ? de.feed.you : run.displayName} · ${formatKm(run.distanceM)} km`}
            </Text>
            <Text variant="caption" color="textMuted">
              {`${formatClock(run.durationS)} · ${new Date(run.startAt).toLocaleDateString('de-DE')}`}
            </Text>
            <View style={styles.actions}>
              {run.isMine ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={de.social.kudosLabel(run.displayName)}
                  accessibilityState={{ selected: run.kudosByMe, disabled: run.kudosByMe }}
                  disabled={run.kudosByMe}
                  onPress={() => {
                    hapticSuccess();
                    kudos.mutate(run.workoutId);
                  }}
                  style={[styles.pill, run.kudosByMe && styles.pillOn]}
                >
                  <Icon name="flame" color={run.kudosByMe ? 'onAccent' : 'accent'} size={18} />
                  <Text variant="caption" color={run.kudosByMe ? 'onAccent' : 'text'}>
                    {run.kudosCount > 0 ? String(run.kudosCount) : de.social.kudos}
                  </Text>
                </Pressable>
              )}
              {run.isMine && run.kudosCount > 0 ? (
                <Pill label={de.social.kudosReceived(run.kudosCount)} tone="accent" />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={de.social.commentsLabel(run.commentCount)}
                onPress={() => setOpen(run)}
                style={styles.pill}
              >
                <Icon name="chatbubble-outline" color="textSecondary" size={18} />
                <Text variant="caption">{String(run.commentCount)}</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
      <CommentsSheet run={open} onClose={() => setOpen(null)} />
    </>
  );
}

function CommentsSheet({ run, onClose }: { run: FriendRun | null; onClose: () => void }) {
  const comments = useRunComments(run?.workoutId ?? '', run !== null);
  const add = useAddComment();
  const remove = useDeleteComment();
  const [text, setText] = useState('');
  return (
    <Sheet
      visible={run !== null}
      title={de.social.commentsTitle}
      onClose={onClose}
      closeLabel={de.social.close}
    >
      {comments.isPending ? (
        <LoadingState />
      ) : comments.isError ? (
        <Text color="danger">{de.social.error}</Text>
      ) : comments.data.length === 0 ? (
        <Text color="textMuted">{de.social.commentsEmpty}</Text>
      ) : (
        comments.data.map((comment) => (
          <View key={comment.id} style={styles.row}>
            <View style={styles.grow}>
              <Text variant="caption" color="textSecondary">
                {comment.isMine ? de.feed.you : comment.displayName}
              </Text>
              <Text>{comment.body}</Text>
            </View>
            {comment.isMine || run?.isMine ? (
              <Button
                label={de.social.delete}
                variant="secondary"
                onPress={() => remove.mutate(comment.id)}
              />
            ) : null}
          </View>
        ))
      )}
      <TextField
        label={de.social.commentLabel}
        value={text}
        onChangeText={setText}
        maxLength={200}
        error={add.isError ? toUserMessage(add.error) : null}
      />
      <Button
        label={de.social.send}
        loading={add.isPending}
        disabled={text.trim().length === 0 || run === null}
        onPress={() => {
          if (run) {
            add.mutate({ workoutId: run.workoutId, body: text }, { onSuccess: () => setText('') });
          }
        }}
      />
    </Sheet>
  );
}

function Groups() {
  const groups = useGroups();
  const create = useCreateGroup();
  const join = useJoinGroup();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [open, setOpen] = useState<Group | null>(null);
  return (
    <>
      <SectionTitle>{de.social.groupsLabel}</SectionTitle>
      {groups.isPending ? (
        <LoadingState />
      ) : groups.isError ? (
        <ErrorState
          message={de.social.error}
          onRetry={() => groups.refetch()}
          retrying={groups.isFetching}
        />
      ) : groups.data.length === 0 ? (
        <Text color="textMuted">{de.social.groupsEmpty}</Text>
      ) : (
        groups.data.map((group) => (
          <Pressable
            key={group.id}
            accessibilityRole="button"
            accessibilityLabel={`${group.name}, ${de.social.members(group.memberCount)}`}
            onPress={() => setOpen(group)}
            style={styles.groupRow}
          >
            <View style={styles.grow}>
              <Text variant="heading">{group.name}</Text>
              <Text variant="caption" color="textMuted">
                {de.social.members(group.memberCount)}
              </Text>
            </View>
            <Icon name="chevron-forward" color="textMuted" />
          </Pressable>
        ))
      )}
      <Card style={styles.card}>
        <TextField
          label={de.social.newGroup}
          value={name}
          onChangeText={setName}
          maxLength={40}
          error={create.isError ? toUserMessage(create.error) : null}
        />
        <Button
          label={de.social.createGroup}
          variant="secondary"
          loading={create.isPending}
          disabled={name.trim().length < 3}
          onPress={() => create.mutate(name, { onSuccess: () => setName('') })}
        />
        <TextField
          label={de.social.joinGroupLabel}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          error={join.isError ? toUserMessage(join.error) : null}
        />
        <Button
          label={de.social.joinGroup}
          variant="secondary"
          loading={join.isPending}
          disabled={code.length < 6}
          onPress={() => join.mutate(code, { onSuccess: () => setCode('') })}
        />
      </Card>
      <GroupSheet group={open} onClose={() => setOpen(null)} />
    </>
  );
}

function GroupSheet({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const board = useGroupBoard(group?.id ?? '', period, group !== null);
  const leave = useLeaveGroup();
  return (
    <Sheet
      visible={group !== null}
      title={group?.name ?? ''}
      onClose={onClose}
      closeLabel={de.social.close}
    >
      <Text variant="caption" color="textSecondary">
        {de.social.groupCode(group?.inviteCode ?? '')}
      </Text>
      <View style={styles.actions}>
        <Button
          label={de.runStats.week}
          variant={period === 'week' ? 'primary' : 'secondary'}
          onPress={() => setPeriod('week')}
        />
        <Button
          label={de.runStats.month}
          variant={period === 'month' ? 'primary' : 'secondary'}
          onPress={() => setPeriod('month')}
        />
      </View>
      {board.isPending ? (
        <LoadingState />
      ) : board.isError ? (
        <Text color="danger">{de.social.error}</Text>
      ) : (
        board.data.map((row) => (
          <View
            key={`${row.rank}-${row.displayName}`}
            style={styles.row}
            accessible
            accessibilityLabel={`${row.rank}. ${row.displayName}: ${formatKm(row.distanceM)} Kilometer`}
          >
            <Text color={row.isMe ? 'accent' : 'textSecondary'}>{`${row.rank}.`}</Text>
            <Text style={styles.grow}>
              {row.isMe ? `${row.displayName} ${de.challenge.you}` : row.displayName}
            </Text>
            <Text>{`${formatKm(row.distanceM)} km`}</Text>
          </View>
        ))
      )}
      <Button
        label={de.social.leaveGroup}
        variant="secondary"
        loading={leave.isPending}
        onPress={() => {
          if (group) {
            leave.mutate(group.id, { onSuccess: onClose });
          }
        }}
      />
    </Sheet>
  );
}

function League() {
  const season = useSeasonBoard();
  return (
    <>
      <SectionTitle>{de.social.leagueLabel}</SectionTitle>
      <Text variant="caption" color="textMuted">
        {de.social.leagueHint}
      </Text>
      {season.isPending ? (
        <LoadingState />
      ) : season.isError ? (
        <ErrorState
          message={de.social.error}
          onRetry={() => season.refetch()}
          retrying={season.isFetching}
        />
      ) : season.data.length === 0 ? (
        <Text color="textMuted">{de.social.leagueEmpty}</Text>
      ) : (
        <Card style={styles.card}>
          {season.data.map((row) => (
            <View
              key={`${row.rank}-${row.displayName}-${row.points}`}
              style={styles.row}
              accessible
              accessibilityLabel={`${row.rank}. ${row.displayName}: ${row.points} Punkte`}
            >
              <Text color={row.isMe ? 'accent' : 'textSecondary'}>{`${row.rank}.`}</Text>
              <Text style={styles.grow}>
                {row.isMe ? `${row.displayName} ${de.challenge.you}` : row.displayName}
              </Text>
              <Text>{`${row.points} P.`}</Text>
            </View>
          ))}
        </Card>
      )}
      <Text variant="caption" color="textMuted">
        {de.social.support(LEGAL.email)}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  section: { gap: spacing.sm },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
  pillOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
});
