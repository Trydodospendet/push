import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ErrorState, Screen, Text, TextField } from '@/components';
import { SIGN_IN_CODE_LENGTH } from '@/config/app';
import { useRequestSignInCode, useVerifySignInCode } from '@/features/auth/api';
import { toUserMessage } from '@/features/auth/errors';
import { signInCodeSchema, validate } from '@/features/auth/schemas';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const verifyCode = useVerifySignInCode();
  const resendCode = useRequestSignInCode();
  const [code, setCode] = useState('');
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

  const submit = (value: string) => {
    const result = validate(signInCodeSchema, value);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setNotice(null);
    // On success the root layout receives the session and leaves the sign-in screens.
    verifyCode.mutate(
      { email, code: result.value },
      { onError: (mutationError) => setError(toUserMessage(mutationError)) },
    );
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, SIGN_IN_CODE_LENGTH);
    setCode(digits);
    if (digits.length === SIGN_IN_CODE_LENGTH && !verifyCode.isPending) {
      submit(digits);
    }
  };

  const handleResend = () => {
    setError(null);
    setNotice(null);
    resendCode.mutate(email, {
      onSuccess: () => setNotice(de.verify.resent),
      onError: (mutationError) => setError(toUserMessage(mutationError)),
    });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.verify.title}
        </Text>
        <Text color="textSecondary">{de.verify.intro(email)}</Text>
      </View>
      <TextField
        label={de.verify.codeLabel}
        value={code}
        onChangeText={handleChange}
        error={error}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={SIGN_IN_CODE_LENGTH}
        returnKeyType="done"
        onSubmitEditing={() => submit(code)}
        autoFocus
      />
      {notice ? (
        <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      <Button
        label={de.verify.submit}
        onPress={() => submit(code)}
        loading={verifyCode.isPending}
      />
      <Button
        label={de.verify.resend}
        variant="secondary"
        onPress={handleResend}
        loading={resendCode.isPending}
      />
      <Button label={de.verify.changeEmail} variant="secondary" onPress={() => router.back()} />
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
});
