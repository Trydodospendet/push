import { StyleSheet } from 'react-native';

import { Card, ErrorState, LoadingState, Screen, SwitchRow, Text } from '@/components';
import { useSetRankingVisibility } from '@/features/account/api';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { hapticSelect } from '@/features/preferences/haptics';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Who sees the name: everybody, or "Anonym" in rankings, the feed and participant lists. */
export default function PrivacySettingsScreen() {
  const session = useSession();
  const profile = useMyProfile(session.user.id);
  const save = useSetRankingVisibility(session.user.id);

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
      <Card style={styles.card}>
        <Text variant="label" color="textSecondary">
          {de.privacySettings.label}
        </Text>
        <SwitchRow
          label={de.privacySettings.anonymous}
          hint={de.privacySettings.anonymousHint}
          value={profile.data.anonymous_in_rankings}
          disabled={save.isPending}
          onChange={(value) => {
            hapticSelect();
            save.mutate(value);
          }}
        />
        {save.isError ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {de.privacySettings.error}
          </Text>
        ) : null}
      </Card>
      <Text variant="caption" color="textMuted">
        {de.privacySettings.other}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
});
