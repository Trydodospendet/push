import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components';
import { useSetDisplayName } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { toUserMessage } from '@/lib/errors';
import { displayNameSchema, validate } from '@/features/auth/schemas';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

export default function OnboardingNameScreen() {
  const session = useSession();
  const setDisplayName = useSetDisplayName(session.user.id);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const result = validate(displayNameSchema, name);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    // On success the profile is onboarded and the root layout switches to the tabs.
    setDisplayName.mutate(result.value, {
      onError: (mutationError) => setError(toUserMessage(mutationError)),
    });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          {de.onboarding.nameTitle}
        </Text>
        <Text color="textSecondary">{de.onboarding.nameIntro}</Text>
      </View>
      <TextField
        label={de.onboarding.nameLabel}
        placeholder={de.onboarding.namePlaceholder}
        hint={de.onboarding.nameHint}
        value={name}
        onChangeText={setName}
        error={error}
        autoCapitalize="words"
        autoComplete="nickname"
        textContentType="nickname"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        autoFocus
      />
      <Button
        label={de.onboarding.nameSubmit}
        onPress={handleSubmit}
        loading={setDisplayName.isPending}
      />
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
