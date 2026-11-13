import { StyleSheet } from 'react-native';

import { ErrorState, LoadingState, Screen } from '@/components';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { useMyProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/auth-provider';
import { DonationDefaultsCard, DonationsOverview } from '@/features/donations/donation-cards';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Default donation setting and the overview "Meine Spenden". */
export default function DonationSettingsScreen() {
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
      <DonationDefaultsCard
        userId={session.user.id}
        donate={profile.data.donate_default}
        ngoId={profile.data.default_ngo_id}
      />
      <DonationsOverview timezone={profile.data.timezone ?? DEFAULT_TIMEZONE} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
});
