import { View, StyleSheet } from 'react-native';
import { Card, Text, ProgressBar } from '@/components';
import { useSession } from '@/features/auth/auth-provider';
import { useMyProfile } from '@/features/auth/api';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { toLocalDate } from '@/lib/dates';
import { useMyDailySteps } from './api';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';
export function TodaySteps({ target }: { target?: number }) {
  const { user } = useSession();
  const profile = useMyProfile(user.id);
  const today = toLocalDate(new Date(), profile.data?.timezone ?? DEFAULT_TIMEZONE);
  const steps = useMyDailySteps(user.id, today, today, true);
  if (!steps.data) return null;
  const total = steps.data.filter((d) => d.isValid).reduce((n, d) => n + d.steps, 0);
  return (
    <Card style={styles.card}>
      <View>
        <Text variant="label">{de.coach.today}</Text>
        <Text variant="heading">
          {total.toLocaleString('de-DE')} {de.progress.unitSteps}
        </Text>
      </View>
      {target ? (
        <ProgressBar
          progress={Math.min(1, total / target)}
          accessibilityLabel={de.progress.barLabel}
        />
      ) : null}
      <Text variant="caption" color="textMuted">
        {de.coach.stepsNote}
      </Text>
    </Card>
  );
}
const styles = StyleSheet.create({ card: { gap: spacing.sm } });
