import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  ErrorState,
  FadeIn,
  Icon,
  LoadingState,
  Pill,
  Screen,
  Text,
} from '@/components';
import { LEGAL } from '@/config/app';
import { useSession } from '@/features/auth/auth-provider';
import { useMyAppeals, type Appeal } from '@/features/help/api';
import { de } from '@/i18n/de';
import { formatKm } from '@/features/gps/format';
import { colors, layout, radius, spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

function statusLabel(status: Appeal['status']): string {
  return de.appeals.status[status];
}

/** Questions and answers, the support contact and the status of the own appeals. */
export default function HelpScreen() {
  const session = useSession();
  const appeals = useMyAppeals(session.user.id);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <Stack.Screen options={{ title: de.help.title }} />
      <FadeIn style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.help.faqLabel}
        </Text>
        {de.help.faq.map((item, index) => {
          const expanded = open === index;
          return (
            <Pressable
              key={item.q}
              accessibilityRole="button"
              accessibilityLabel={item.q}
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : index)}
              style={styles.faqItem}
            >
              <View style={styles.faqHead}>
                <Text style={styles.faqQuestion}>{item.q}</Text>
                <Icon name={expanded ? 'chevron-up' : 'chevron-down'} color="textMuted" />
              </View>
              {expanded ? (
                <Text color="textSecondary" accessibilityLiveRegion="polite">
                  {item.a}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
        <Button
          label={de.profile.howItWorks}
          variant="secondary"
          onPress={() => router.push('/how-it-works')}
        />
      </FadeIn>

      <FadeIn delayMs={80} style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.help.appealsLabel}
        </Text>
        {appeals.isPending ? (
          <LoadingState />
        ) : appeals.isError ? (
          <ErrorState
            message={de.appeals.error}
            onRetry={() => appeals.refetch()}
            retrying={appeals.isFetching}
          />
        ) : appeals.data.length === 0 ? (
          <Text color="textMuted">{de.help.appealsEmpty}</Text>
        ) : (
          appeals.data.map((appeal) => (
            <Card
              key={appeal.id}
              style={styles.appeal}
              accessible
              accessibilityLabel={`${de.appeals.runOf(appeal.distanceM === null ? '' : formatKm(appeal.distanceM))}, ${statusLabel(appeal.status)}`}
            >
              <View style={styles.appealHead}>
                <Text variant="heading">
                  {de.appeals.runOf(appeal.distanceM === null ? '' : formatKm(appeal.distanceM))}
                </Text>
                <Pill
                  label={statusLabel(appeal.status)}
                  tone={appeal.status === 'accepted' ? 'accent' : 'neutral'}
                />
              </View>
              <Text variant="caption" color="textMuted">
                {appeal.message}
              </Text>
              {appeal.resolutionNote ? (
                <Text variant="caption" color="textSecondary">
                  {de.appeals.answer(appeal.resolutionNote)}
                </Text>
              ) : null}
            </Card>
          ))
        )}
        <Text variant="caption" color="textMuted">
          {de.help.appealsHint}
        </Text>
      </FadeIn>

      <FadeIn delayMs={160} style={styles.section}>
        <Text variant="label" color="textSecondary" accessibilityRole="header">
          {de.help.supportLabel}
        </Text>
        <Card style={styles.support}>
          <Text color="textSecondary">{de.help.supportText}</Text>
          <Text selectable>{LEGAL.email}</Text>
          <Button
            label={de.help.writeUs}
            onPress={() =>
              void Linking.openURL(
                `mailto:${LEGAL.email}?subject=${encodeURIComponent(de.help.mailSubject)}`,
              )
            }
          />
        </Card>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  section: { gap: spacing.sm },
  faqItem: {
    gap: spacing.xs,
    padding: spacing.md,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  faqQuestion: { flex: 1 },
  appeal: { gap: spacing.xs },
  appealHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  support: { gap: spacing.sm },
});
