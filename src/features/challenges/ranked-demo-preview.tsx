import { Image, StyleSheet, View } from 'react-native';

import { Card, Pill, Text } from '@/components';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

const AVATAR_SIZE = 48;

const participants = [
  ['Mia Schneider', '24,8'],
  ['Leon Fischer', '23,4'],
  ['Amira Yilmaz', '22,9'],
  ['Noah Becker', '21,7'],
  ['Lena Hoffmann', '20,2'],
  ['Ben Wagner', '19,8'],
  ['Nora Kaya', '18,6'],
  ['Finn Weber', '17,9'],
  ['Aylin Demir', '16,5'],
  ['Paul Richter', '15,8'],
  ['Ella Braun', '14,7'],
  ['Elias Krüger', '13,9'],
  ['Zoe Fischer', '12,8'],
  ['Oskar Neumann', '11,6'],
  ['Sara Özdemir', '10,8'],
  ['Maximilian Wolf', '9,7'],
  ['Jana Peters', '8,9'],
  ['David Klein', '7,8'],
  ['Mila Hartmann', '6,4'],
  ['Tom Schneider', '5,2'],
] as const;

/** Local-only sample leaderboard; never uses or inserts backend accounts or credits. */
export function RankedDemoPreview({
  metric = 'km',
  cycle = 'day',
}: {
  metric?: 'km' | 'steps';
  cycle?: 'day' | 'week' | 'month';
}) {
  if (!__DEV__) {
    return null;
  }

  const valueLabel = (distance: string) => {
    const value =
      Number(distance.replace(',', '.')) * (cycle === 'month' ? 10 : cycle === 'week' ? 3 : 1);
    return metric === 'steps'
      ? `${Math.round(value * 1000).toLocaleString('de-DE')} ${de.improvements.steps}`
      : de.challenges.demoDistance(value.toLocaleString('de-DE', { maximumFractionDigits: 1 }));
  };
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text variant="label" color="accent" accessibilityRole="header">
          {de.challenges.demoTitle}
        </Text>
        <Pill label={de.challenges.demoLabel} tone="neutral" />
      </View>
      <Text color="textSecondary">{de.challenges.demoSubtitle}</Text>
      <Text variant="caption" color="textMuted">
        {de.challenges.demoNoStake}
      </Text>
      <Card style={styles.card}>
        {participants.map(([name, distance], index) => (
          <View
            key={name}
            style={[styles.row, index > 0 && styles.divider]}
            accessible
            accessibilityLabel={[
              `${index + 1}. ${name}`,
              valueLabel(distance),
              de.challenges.demoBalance,
            ].join(', ')}
          >
            <Text variant="label" color={index < 3 ? 'accent' : 'textMuted'} style={styles.rank}>
              {index + 1}
            </Text>
            <DemoAvatar index={index} />
            <View style={styles.details}>
              <Text numberOfLines={1}>{name}</Text>
              <Text variant="caption" color="textMuted">
                {de.challenges.demoBalance}
              </Text>
            </View>
            <Text variant="label" style={styles.distance}>
              {valueLabel(distance)}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

function DemoAvatar({ index }: { index: number }) {
  const column = index % 4;
  const row = Math.floor(index / 4);

  return (
    <View
      style={styles.avatar}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={require('../../../assets/ranked-demo-avatars.png')}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: AVATAR_SIZE * 4,
          height: AVATAR_SIZE * 5,
          left: -column * AVATAR_SIZE,
          top: -row * AVATAR_SIZE,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  row: {
    minHeight: AVATAR_SIZE + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  divider: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
  },
  rank: {
    width: spacing.lg,
    textAlign: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  distance: {
    minWidth: 54,
    textAlign: 'right',
  },
});
