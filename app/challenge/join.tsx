import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Text, TextField } from '@/components';
import { INVITE_CODE_LENGTH } from '@/config/app';
import { useChallengeByCode, useJoinChallenge } from '@/features/challenges/api';
import { ChallengeFacts } from '@/features/challenges/challenge-facts';
import { describeGoal, isJoinable } from '@/features/challenges/format';
import { JoinSheet } from '@/features/challenges/join-sheet';
import { inviteCodeSchema } from '@/features/challenges/schemas';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { spacing } from '@/theme';

export default function JoinByCodeScreen() {
  const router = useRouter();
  // A link like push://join/ABC123 opens this screen with the code already filled in.
  const params = useLocalSearchParams<{ code?: string }>();
  const fromLink = inviteCodeSchema.safeParse(params.code ?? '');
  const [input, setInput] = useState(fromLink.success ? fromLink.data : '');
  const [inputError, setInputError] = useState<string | null>(null);
  // The code that is being previewed; null until the user submitted a valid code.
  const [code, setCode] = useState<string | null>(fromLink.success ? fromLink.data : null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const preview = useChallengeByCode(code);
  const join = useJoinChallenge();
  const canJoin =
    preview.data !== undefined && preview.data.mode !== 'goal' && isJoinable(preview.data);

  const handleShow = () => {
    const result = inviteCodeSchema.safeParse(input);
    if (!result.success) {
      setInputError(result.error.issues[0]?.message ?? de.joinByCode.invalidCode);
      setCode(null);
      return;
    }
    setInputError(null);
    setCode(result.data);
  };

  const handleConfirm = (stakeCents: number) => {
    if (!code || !preview.data || !canJoin) {
      return;
    }
    const challengeId = preview.data.id;
    join.mutate(
      { code, stakeCents: preview.data.mode === 'ranked' ? undefined : stakeCents },
      {
        onSuccess: () => {
          setSheetVisible(false);
          router.replace({
            pathname: '/challenge/[id]',
            params: { id: challengeId, started: '1' },
          });
        },
      },
    );
  };

  return (
    <Screen scroll edges={['bottom', 'left', 'right']} contentStyle={styles.content}>
      <Text color="textSecondary">{de.joinByCode.intro}</Text>
      <TextField
        label={de.joinByCode.codeLabel}
        value={input}
        onChangeText={(text) => setInput(text.toUpperCase())}
        error={inputError}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={INVITE_CODE_LENGTH}
        returnKeyType="search"
        onSubmitEditing={handleShow}
        autoFocus
      />
      <Button
        label={de.joinByCode.submit}
        variant={preview.data ? 'secondary' : 'primary'}
        onPress={handleShow}
        loading={preview.isFetching}
      />

      {code && preview.isPending ? <LoadingState /> : null}
      {code && preview.isError ? <ErrorState message={toUserMessage(preview.error)} /> : null}
      {preview.data ? (
        <View style={styles.preview}>
          <Card style={styles.previewHeader}>
            <Text variant="heading">{preview.data.title}</Text>
            <Text color="textSecondary">
              {describeGoal(preview.data.goal_type, preview.data.target_value)}
            </Text>
          </Card>
          <ChallengeFacts challenge={preview.data} />
          {canJoin ? (
            <Button label={de.challenge.join} onPress={() => setSheetVisible(true)} />
          ) : (
            <Text color="textMuted">
              {preview.data.mode === 'goal'
                ? de.challenge.goalNotJoinable
                : de.challenge.notJoinable}
            </Text>
          )}
          <JoinSheet
            mode={preview.data.mode === 'ranked' ? 'ranked' : 'pool'}
            stakeCents={preview.data.stake_cents}
            visible={sheetVisible}
            onClose={() => {
              setSheetVisible(false);
              join.reset();
            }}
            onConfirm={handleConfirm}
            joining={join.isPending}
            error={join.isError ? toUserMessage(join.error) : null}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  preview: {
    gap: spacing.md,
  },
  previewHeader: {
    gap: spacing.xxs,
  },
});
