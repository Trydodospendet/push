import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Text, TextField } from '@/components';
import { INVITE_CODE_LENGTH } from '@/config/app';
import { useChallengeByCode, useJoinChallenge } from '@/features/challenges/api';
import { ChallengeFacts } from '@/features/challenges/challenge-facts';
import { describeGoal } from '@/features/challenges/format';
import { JoinSheet } from '@/features/challenges/join-sheet';
import { inviteCodeSchema } from '@/features/challenges/schemas';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { spacing } from '@/theme';

export default function JoinByCodeScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  // The code that is being previewed; null until the user submitted a valid code.
  const [code, setCode] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const preview = useChallengeByCode(code);
  const join = useJoinChallenge();

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

  const handleConfirm = () => {
    if (!code || !preview.data) {
      return;
    }
    const challengeId = preview.data.id;
    join.mutate(
      { code },
      {
        onSuccess: () => {
          setSheetVisible(false);
          router.replace({ pathname: '/challenge/[id]', params: { id: challengeId } });
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
          <Button label={de.challenge.join} onPress={() => setSheetVisible(true)} />
          <JoinSheet
            challenge={preview.data}
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
