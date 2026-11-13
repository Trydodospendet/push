import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ErrorState, FadeIn, GlowBackdrop, Screen, Text } from '@/components';
import { SIGN_IN_CODE_LENGTH } from '@/config/app';
import { useRequestSignInCode, useVerifySignInCode } from '@/features/auth/api';
import { CodeInput, type CodeInputState } from '@/features/auth/code-input';
import { signInCodeSchema, validate } from '@/features/auth/schemas';
import { useCountdown } from '@/features/auth/use-countdown';
import { hapticError, hapticSuccess } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { toUserMessage } from '@/lib/errors';
import { spacing } from '@/theme';

const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { email, reset } = useLocalSearchParams<{ email?: string; reset?: string }>();
  const verifyCode = useVerifySignInCode();
  const resendCode = useRequestSignInCode();
  const countdown = useCountdown(RESEND_SECONDS);
  const [code, setCode] = useState('');
  const [state, setState] = useState<CodeInputState>('idle');
  const [shakeKey, setShakeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!email) {
    return (
      <Screen>
        <ErrorState message={de.verify.missingEmail} />
        <Button label={de.verify.changeEmail} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const wrong = (message: string) => {
    setState('error');
    setError(message);
    setShakeKey((key) => key + 1);
    hapticError();
    // Back to typing: the user clears the boxes by typing again.
    setTimeout(() => {
      setCode('');
      setState('idle');
    }, 700);
  };

  const submit = (value: string) => {
    const result = validate(signInCodeSchema, value);
    if (!result.ok) {
      wrong(result.message);
      return;
    }
    setError(null);
    setNotice(null);
    // On success the root layout receives the session and leaves the sign-in screens.
    verifyCode.mutate(
      { email, code: result.value },
      {
        onSuccess: () => {
          setState('success');
          hapticSuccess();
        },
        onError: (mutationError) => wrong(toUserMessage(mutationError)),
      },
    );
  };

  const handleChange = (digits: string) => {
    if (state === 'error') {
      return;
    }
    setCode(digits);
    setError(null);
    if (digits.length === SIGN_IN_CODE_LENGTH && !verifyCode.isPending) {
      submit(digits);
    }
  };

  const handleResend = () => {
    setError(null);
    setNotice(null);
    resendCode.mutate(email, {
      onSuccess: () => {
        setNotice(de.verify.resent);
        countdown.restart();
      },
      onError: (mutationError) => wrong(toUserMessage(mutationError)),
    });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <GlowBackdrop />
      <FadeIn style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.verify.title}
        </Text>
        <Text color="textSecondary">{de.verify.intro(email)}</Text>
        {reset ? <Text color="accent">{de.verify.resetHint}</Text> : null}
      </FadeIn>
      <FadeIn delayMs={100} style={styles.code}>
        <CodeInput
          length={SIGN_IN_CODE_LENGTH}
          value={code}
          onChange={handleChange}
          state={state}
          shakeKey={shakeKey}
          disabled={verifyCode.isPending || state === 'success'}
          accessibilityLabel={de.verify.codeLabel}
        />
        <View style={styles.messages} accessibilityLiveRegion="polite">
          {error ? (
            <Text variant="caption" color="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : notice ? (
            <Text variant="caption" color="textSecondary">
              {notice}
            </Text>
          ) : (
            <Text variant="caption" color="textMuted">
              {de.verify.pasteHint}
            </Text>
          )}
        </View>
      </FadeIn>
      <FadeIn delayMs={200} style={styles.actions}>
        <Button
          label={de.verify.submit}
          onPress={() => submit(code)}
          loading={verifyCode.isPending}
          disabled={code.length < SIGN_IN_CODE_LENGTH}
        />
        <Button
          label={countdown.left > 0 ? de.verify.resendIn(countdown.left) : de.verify.resend}
          variant="secondary"
          onPress={handleResend}
          loading={resendCode.isPending}
          disabled={countdown.left > 0}
        />
        <Button label={de.verify.changeEmail} variant="secondary" onPress={() => router.back()} />
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
  code: {
    gap: spacing.sm,
  },
  messages: {
    minHeight: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
});
