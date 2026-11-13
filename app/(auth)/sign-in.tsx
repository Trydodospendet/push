import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ChipGroup, FadeIn, GlowBackdrop, Screen, Text, TextField } from '@/components';
import { useSignInWithPassword } from '@/features/account/api';
import { useRequestSignInCode } from '@/features/auth/api';
import { emailSchema, validate } from '@/features/auth/schemas';
import { hapticError, hapticTap } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { spacing } from '@/theme';

type Mode = 'code' | 'password';

/** E-mail first; then either a one-time code (default) or the password. */
export default function SignInScreen() {
  const router = useRouter();
  const requestCode = useRequestSignInCode();
  const signInWithPassword = useSignInWithPassword();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fail = (message: string) => {
    setError(message);
    setPasswordError(null);
    hapticError();
  };

  const sendCode = (reset: boolean) => {
    const result = validate(emailSchema, email);
    if (!result.ok) {
      fail(result.message);
      return;
    }
    setError(null);
    hapticTap();
    requestCode.mutate(
      { email: result.value },
      {
      onSuccess: () =>
        router.push({
          pathname: '/verify',
          params: reset ? { email: result.value, reset: '1' } : { email: result.value },
        }),
      onError: (mutationError) => fail(toUserMessage(mutationError)),
      },
    );
  };

  const submitPassword = () => {
    const result = validate(emailSchema, email);
    if (!result.ok) {
      fail(result.message);
      return;
    }
    if (password.length === 0) {
      setError(null);
      setPasswordError(de.signIn.passwordMissing);
      hapticError();
      return;
    }
    setError(null);
    setPasswordError(null);
    hapticTap();
    // On success the root layout receives the session and leaves the sign-in screens.
    signInWithPassword.mutate(
      { email: result.value, password },
      { onError: (mutationError) => fail(toUserMessage(mutationError)) },
    );
  };

  const handleSubmit = () => (mode === 'code' ? sendCode(false) : submitPassword());

  return (
    <Screen scroll contentStyle={styles.content}>
      <GlowBackdrop />
      <FadeIn style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.signIn.title}
        </Text>
        <Text color="textSecondary">
          {mode === 'code' ? de.signIn.intro : de.signIn.introPassword}
        </Text>
      </FadeIn>
      <FadeIn delayMs={80}>
        <ChipGroup
          label={de.signIn.modeLabel}
          options={[
            { value: 'code', label: de.signIn.modeCode },
            { value: 'password', label: de.signIn.modePassword },
          ]}
          value={mode}
          onChange={(value: Mode) => {
            setMode(value);
            setError(null);
            setPasswordError(null);
          }}
        />
      </FadeIn>
      <FadeIn delayMs={160} style={styles.fields}>
        <TextField
          label={de.signIn.emailLabel}
          placeholder={de.signIn.emailPlaceholder}
          value={email}
          onChangeText={setEmail}
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType={mode === 'code' ? 'send' : 'next'}
          onSubmitEditing={mode === 'code' ? handleSubmit : undefined}
          autoFocus
        />
        {mode === 'password' ? (
          <TextField
            label={de.signIn.passwordLabel}
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        ) : null}
      </FadeIn>
      <FadeIn delayMs={240} style={styles.actions}>
        <Button
          label={mode === 'code' ? de.signIn.submit : de.signIn.submitPassword}
          onPress={handleSubmit}
          loading={requestCode.isPending || signInWithPassword.isPending}
        />
        <Button
          label={de.signIn.noAccountYet}
          variant="secondary"
          onPress={() => router.replace('/sign-up')}
        />
        {mode === 'password' ? (
          <View style={styles.forgot}>
            <Text variant="caption" color="textMuted">
              {de.signIn.forgotHint}
            </Text>
            <Button
              label={de.signIn.forgot}
              variant="secondary"
              onPress={() => sendCode(true)}
              loading={requestCode.isPending}
            />
          </View>
        ) : null}
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  fields: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  forgot: {
    gap: spacing.xs,
  },
});
