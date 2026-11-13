import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, FadeIn, GlowBackdrop, Screen, Text, TextField } from '@/components';
import { PASSWORD_MIN_LENGTH } from '@/features/account/api';
import { useRequestSignInCode } from '@/features/auth/api';
import { emailSchema, validate } from '@/features/auth/schemas';
import { setSignupDraft } from '@/features/auth/signup-draft';
import { hapticError, hapticTap } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { spacing } from '@/theme';

/** Registering: e-mail and a first password; the e-mail is confirmed with a code afterwards. */
export default function SignUpScreen() {
  const router = useRouter();
  const requestCode = useRequestSignInCode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const submit = () => {
    const result = validate(emailSchema, email);
    if (!result.ok) {
      setEmailError(result.message);
      setPasswordError(null);
      hapticError();
      return;
    }
    setEmailError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setPasswordError(de.account.passwordTooShort(PASSWORD_MIN_LENGTH));
      hapticError();
      return;
    }
    if (password !== repeat) {
      setPasswordError(de.signUp.passwordMismatch);
      hapticError();
      return;
    }
    setPasswordError(null);
    hapticTap();
    requestCode.mutate(
      { email: result.value, createUser: true },
      {
        onSuccess: () => {
          setSignupDraft(result.value, password);
          router.push({ pathname: '/verify', params: { email: result.value, signup: '1' } });
        },
        onError: (mutationError) => {
          setEmailError(toUserMessage(mutationError));
          hapticError();
        },
      },
    );
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <GlowBackdrop />
      <FadeIn style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.signUp.title}
        </Text>
        <Text color="textSecondary">{de.signUp.intro}</Text>
      </FadeIn>
      <FadeIn delayMs={120} style={styles.fields}>
        <TextField
          label={de.signIn.emailLabel}
          placeholder={de.signIn.emailPlaceholder}
          value={email}
          onChangeText={setEmail}
          error={emailError}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          autoFocus
        />
        <TextField
          label={de.signUp.passwordLabel}
          hint={de.signUp.passwordHint(PASSWORD_MIN_LENGTH)}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />
        <TextField
          label={de.signUp.repeatLabel}
          value={repeat}
          onChangeText={setRepeat}
          error={passwordError}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </FadeIn>
      <FadeIn delayMs={240} style={styles.fields}>
        <Button label={de.signUp.submit} onPress={submit} loading={requestCode.isPending} />
        <Button
          label={de.signUp.haveAccount}
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
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
});
