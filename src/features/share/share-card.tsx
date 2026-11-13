import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlowBackdrop, Text } from '@/components';
import { APP_NAME } from '@/config/app';
import { MiniRoute } from '@/features/gps/mini-route';
import { de } from '@/i18n/de';
import { colors, radius, spacing } from '@/theme';

export type ShareCardData = {
  /** Small heading, e.g. "MEIN LAUF" or "GEWONNEN". */
  label: string;
  /** The big number, e.g. "5,20 km" or "+13,33". */
  headline: string;
  /** Line below, e.g. "Credits" or the title of the challenge. */
  subline?: string;
  /** Up to three small facts, e.g. time, pace, date. */
  facts: readonly { label: string; value: string }[];
  /** Shape of the route (normalized 0–1000 box, no coordinates, no map). */
  shape?: readonly (readonly [number, number])[] | null;
};

/** Size of the picture that is shared (a 9:16 story). The card is laid out at a third of it. */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;
const LAYOUT_WIDTH = 360;
const LAYOUT_HEIGHT = 640;

/**
 * The picture for Instagram and TikTok stories: black, lime glow, the shape of the run, the big
 * number. It shows no map, no start or end point and no name – only what the user chose to
 * share. Rendered off screen and captured as an image.
 */
export const ShareCard = forwardRef<ComponentRef<typeof View>, { data: ShareCardData }>(
  function ShareCard({ data }, ref) {
    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <GlowBackdrop size={560} intensity={0.35} />
        <Text variant="label" color="accent">
          {data.label}
        </Text>
        <View style={styles.shape}>
          {data.shape && data.shape.length >= 2 ? (
            <MiniRoute points={data.shape} size={260} />
          ) : null}
        </View>
        <Text variant="display" align="center" numberOfLines={1} adjustsFontSizeToFit>
          {data.headline}
        </Text>
        {data.subline ? (
          <Text variant="heading" color="textSecondary" align="center" numberOfLines={2}>
            {data.subline}
          </Text>
        ) : null}
        <View style={styles.facts}>
          {data.facts.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Text variant="label" color="textSecondary" align="center">
                {fact.label}
              </Text>
              <Text variant="heading" align="center">
                {fact.value}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="title" align="center" style={styles.brand}>
          {`${APP_NAME}.`}
        </Text>
        <Text variant="label" color="textMuted" align="center">
          {de.welcome.claim}
        </Text>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: LAYOUT_WIDTH,
    height: LAYOUT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  shape: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facts: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  fact: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  brand: {
    marginTop: spacing.xl,
  },
});
