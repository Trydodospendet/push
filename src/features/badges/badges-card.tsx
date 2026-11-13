import { StyleSheet, View } from 'react-native';

import { Card, ErrorState, Icon, LoadingState, ProgressBar, Text } from '@/components';
import { de } from '@/i18n/de';
import { colors, layout, radius, spacing } from '@/theme';

import { useMyBadges, useMyLevel } from './api';
import { BADGE_CODES, BADGE_ICONS } from './catalog';

const pointsFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** Level with progress to the next one, and all badges (earned ones in lime). */
export function BadgesCard({ userId }: { userId: string }) {
  const level = useMyLevel(userId);
  const badges = useMyBadges(userId);

  if (level.isPending || badges.isPending) {
    return <LoadingState />;
  }
  if (level.isError || badges.isError) {
    return (
      <ErrorState
        message={de.badges.error}
        onRetry={() => {
          void level.refetch();
          void badges.refetch();
        }}
        retrying={level.isFetching || badges.isFetching}
      />
    );
  }

  const earned = new Set(badges.data.map((badge) => badge.code));
  const span = level.data.nextLevelPoints - level.data.levelStartPoints;
  const done = level.data.points - level.data.levelStartPoints;

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.badges.label}
      </Text>
      <View
        accessible
        accessibilityLabel={de.badges.levelSpoken(
          level.data.level,
          pointsFormat.format(level.data.nextLevelPoints - level.data.points),
        )}
        style={styles.level}
      >
        <Text variant="heading">{de.badges.level(level.data.level)}</Text>
        <ProgressBar
          progress={span > 0 ? done / span : 0}
          accessibilityLabel={de.badges.levelProgress}
        />
        <Text variant="caption" color="textMuted">
          {de.badges.points(
            pointsFormat.format(level.data.points),
            pointsFormat.format(level.data.nextLevelPoints),
          )}
        </Text>
      </View>
      <View style={styles.grid}>
        {BADGE_CODES.map((code) => {
          const copy = de.badges.items[code];
          const has = earned.has(code);
          return (
            <View
              key={code}
              style={styles.item}
              accessible
              accessibilityLabel={`${copy.title}: ${copy.description}. ${
                has ? de.badges.earned : de.badges.locked
              }`}
            >
              <View style={[styles.circle, has && styles.circleEarned]}>
                <Icon name={BADGE_ICONS[code]} color={has ? 'onAccent' : 'textMuted'} />
              </View>
              <Text variant="caption" color={has ? 'text' : 'textMuted'} align="center">
                {copy.title}
              </Text>
            </View>
          );
        })}
      </View>
      <Text variant="caption" color="textMuted">
        {de.badges.pointsHint}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  level: {
    gap: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  item: {
    width: '28%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  circle: {
    width: layout.minTouchTarget + spacing.sm,
    height: layout.minTouchTarget + spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
  circleEarned: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
