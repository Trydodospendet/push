import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

/** Phase 1: only the empty state. Active challenges follow in phase 2/3. */
export default function HomeScreen() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <Text variant="label" color="textSecondary">
        {de.home.label}
      </Text>
      <View style={styles.empty}>
        <Text variant="title" accessibilityRole="header">
          {de.home.emptyTitle}
        </Text>
        <Text color="textSecondary">{de.home.emptyText}</Text>
      </View>
      <Button label={de.home.findChallenge} onPress={() => router.navigate('/challenges')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
