import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  ErrorState,
  LoadingState,
  Screen,
  Text,
  TextField,
} from '@/components';
import {
  PASSWORD_MIN_LENGTH,
  useAvatarUrl,
  useChangeAvatar,
  useConfirmEmailChange,
  useRemoveAvatar,
  useRequestEmailChange,
  useSetPassword,
  useSignOutEverywhere,
} from '@/features/account/api';
import { useMyProfile, useSetDisplayName } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import {
  displayNameSchema,
  emailSchema,
  signInCodeSchema,
  validate,
} from '@/features/auth/schemas';
import { hapticSuccess } from '@/features/preferences/haptics';
import { SIGN_IN_CODE_LENGTH } from '@/config/app';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Picture, name, e-mail, password and "sign out on all devices". */
export default function AccountScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);

  if (profile.isPending) {
    return (
      <Screen edges={SCREEN_EDGES}>
        <LoadingState />
      </Screen>
    );
  }
  if (profile.isError) {
    return (
      <Screen edges={SCREEN_EDGES}>
        <ErrorState
          message={de.profile.error}
          onRetry={() => profile.refetch()}
          retrying={profile.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <PictureCard
        userId={session.user.id}
        name={profile.data.display_name}
        avatarPath={profile.data.avatar_path}
      />
      <NameCard userId={session.user.id} name={profile.data.display_name} />
      <EmailCard email={session.user.email ?? ''} />
      <PasswordCard />
      <SessionsCard />
    </Screen>
  );
}

function PictureCard({
  userId,
  name,
  avatarPath,
}: {
  userId: string;
  name: string;
  avatarPath: string | null;
}) {
  const url = useAvatarUrl(avatarPath);
  const change = useChangeAvatar(userId, avatarPath);
  const remove = useRemoveAvatar(userId, avatarPath);
  const denied = change.data === 'denied';
  const failed = change.isError || remove.isError;

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.account.pictureLabel}
      </Text>
      <View style={styles.pictureRow}>
        <Avatar name={name} size="lg" highlight uri={url.data ?? null} />
        <View style={styles.grow}>
          <Button
            label={de.account.changePicture}
            variant="secondary"
            loading={change.isPending}
            onPress={() => change.mutate()}
          />
          {avatarPath ? (
            <Button
              label={de.account.removePicture}
              variant="secondary"
              loading={remove.isPending}
              onPress={() => remove.mutate()}
            />
          ) : null}
        </View>
      </View>
      <Text variant="caption" color="textMuted">
        {de.account.pictureHint}
      </Text>
      {denied ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {de.account.pictureDenied}
        </Text>
      ) : null}
      {failed ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {de.account.pictureError}
        </Text>
      ) : null}
    </Card>
  );
}

function NameCard({ userId, name }: { userId: string; name: string }) {
  const save = useSetDisplayName(userId);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = () => {
    const result = validate(displayNameSchema, value);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setSaved(false);
    save.mutate(result.value, {
      onSuccess: () => {
        setSaved(true);
        hapticSuccess();
      },
      onError: (mutationError) => setError(toUserMessage(mutationError)),
    });
  };

  return (
    <Card style={styles.card}>
      <TextField
        label={de.account.nameLabel}
        value={value}
        onChangeText={setValue}
        error={error}
        autoCapitalize="words"
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {saved ? (
        <Text variant="caption" color="accent" accessibilityLiveRegion="polite">
          {de.account.nameSaved}
        </Text>
      ) : null}
      <Button
        label={de.account.nameSave}
        variant="secondary"
        loading={save.isPending}
        onPress={submit}
      />
    </Card>
  );
}

function EmailCard({ email }: { email: string }) {
  const request = useRequestEmailChange();
  const confirm = useConfirmEmailChange();
  const [next, setNext] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = () => {
    const result = validate(emailSchema, next);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    request.mutate(result.value, {
      onSuccess: () => setSentTo(result.value),
      onError: (mutationError) => setError(toUserMessage(mutationError)),
    });
  };

  const verify = () => {
    const result = validate(signInCodeSchema, code);
    if (!result.ok || !sentTo) {
      setError(result.ok ? de.verify.missingEmail : result.message);
      return;
    }
    setError(null);
    confirm.mutate(
      { email: sentTo, code: result.value },
      {
        onSuccess: () => {
          setDone(true);
          setSentTo(null);
          setNext('');
          setCode('');
          hapticSuccess();
        },
        onError: (mutationError) => setError(toUserMessage(mutationError)),
      },
    );
  };

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.account.emailLabel}
      </Text>
      <Text>{de.account.emailCurrent(email)}</Text>
      {sentTo === null ? (
        <>
          <TextField
            label={de.account.emailNew}
            value={next}
            onChangeText={setNext}
            error={error}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <Button
            label={de.account.emailSend}
            variant="secondary"
            loading={request.isPending}
            onPress={send}
          />
        </>
      ) : (
        <>
          <Text color="textSecondary">{de.account.emailSent(sentTo)}</Text>
          <TextField
            label={de.account.emailCode}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, SIGN_IN_CODE_LENGTH))}
            error={error}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={SIGN_IN_CODE_LENGTH}
            onSubmitEditing={verify}
          />
          <Button label={de.account.emailConfirm} loading={confirm.isPending} onPress={verify} />
        </>
      )}
      {done ? (
        <Text variant="caption" color="accent" accessibilityLiveRegion="polite">
          {de.account.emailDone}
        </Text>
      ) : null}
    </Card>
  );
}

function PasswordCard() {
  const save = useSetPassword();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = () => {
    setSaved(false);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(de.account.passwordTooShort(PASSWORD_MIN_LENGTH));
      return;
    }
    if (password !== repeat) {
      setError(de.account.passwordMismatch);
      return;
    }
    setError(null);
    save.mutate(password, {
      onSuccess: () => {
        setSaved(true);
        setPassword('');
        setRepeat('');
        hapticSuccess();
      },
      onError: (mutationError) => setError(toUserMessage(mutationError)),
    });
  };

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.account.passwordLabel}
      </Text>
      <Text variant="caption" color="textMuted">
        {de.account.passwordHint}
      </Text>
      <TextField
        label={de.account.passwordNew}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
      />
      <TextField
        label={de.account.passwordRepeat}
        value={repeat}
        onChangeText={setRepeat}
        error={error}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {saved ? (
        <Text variant="caption" color="accent" accessibilityLiveRegion="polite">
          {de.account.passwordSaved}
        </Text>
      ) : null}
      <Button
        label={de.account.passwordSave}
        variant="secondary"
        loading={save.isPending}
        onPress={submit}
      />
    </Card>
  );
}

function SessionsCard() {
  const signOut = useSignOutEverywhere();
  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.account.sessionsLabel}
      </Text>
      <Text variant="caption" color="textMuted">
        {de.account.signOutEverywhereHint}
      </Text>
      {signOut.isError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {de.account.signOutEverywhereError}
        </Text>
      ) : null}
      <Button
        label={de.account.signOutEverywhere}
        variant="secondary"
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
  pictureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.sm },
});
