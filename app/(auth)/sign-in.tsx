import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components';
import { useRequestSignInCode } from '@/features/auth/api';
import { toUserMessage } from '@/features/auth/errors';
import { emailSchema, validate } from '@/features/auth/schemas';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const requestCode = useRequestSignInCode();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const result = validate(emailSchema, email);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    requestCode.mutate(result.value, {
      onSuccess: () => router.push({ pathname: '/verify', params: { email: result.value } }),
      onError: (mutationError) => setError(toUserMessage(mutationError)),
    });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.signIn.title}
        </Text>
        <Text color="textSecondary">{de.signIn.intro}</Text>
      </View>
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
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        autoFocus
      />
      <Button label={de.signIn.submit} onPress={handleSubmit} loading={requestCode.isPending} />
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
