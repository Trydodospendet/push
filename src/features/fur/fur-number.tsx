import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, useAnimatedValue, View } from 'react-native';

import { Text } from '@/components/text';
import { useMotionEnabled } from '@/features/preferences/motion';

import { de } from '@/i18n/de';

import { furAspect, furImages, type FurUnit } from './images';

const OVERLAP = 0.06;
const COMMA_SCALE = 0.3;
const UNIT_SCALE = 0.45;
const unitWord: Record<FurUnit, string> = {
  km: de.fur.unitKm,
  kmh: de.fur.unitKmh,
  schritte: de.fur.unitSteps,
};
const SUPPORTED = /^[0-9.,]+$/;

type Part = { key: string; kind: 'digit'; digit: number } | { key: string; kind: 'comma' };

/** Splits "12.345,6" into images; the thousands dot is dropped, only the comma is drawn. */
function parts(value: string): Part[] {
  return [...value.replace(/\./g, '')].map((char, index) =>
    char === ','
      ? { key: `c${index}`, kind: 'comma' }
      : { key: `d${index}`, kind: 'digit', digit: Number(char) },
  );
}

/** Width of the row for a digit height of 1. */
function rowWidth(value: string, unit?: FurUnit): number {
  const width = parts(value).reduce(
    (total, part, index) =>
      total +
      (part.kind === 'comma' ? COMMA_SCALE * furAspect.comma : furAspect.digits[part.digit]) -
      (index === 0 ? 0 : OVERLAP),
    0,
  );
  return unit ? width + 0.12 + UNIT_SCALE * furAspect.units[unit] : width;
}

/**
 * A number made of fur digits. Falls back to plain text for anything the images cannot draw
 * (for example "–:––" while a pace is unknown). The label always carries the real value.
 */
export function FurNumber({
  value,
  unit,
  height: wantedHeight = 72,
  maxWidth,
  label,
  testID,
}: {
  /** Formatted German number, e.g. "3,60" or "8.421". */
  value: string;
  unit?: FurUnit;
  /** Height of the digits in points. */
  height?: number;
  /** Shrinks the digits when the row would be wider than this. */
  maxWidth?: number;
  /** Spoken text; defaults to the value with its unit. */
  label?: string;
  testID?: string;
}) {
  const motion = useMotionEnabled();
  const hop = useAnimatedValue(0);
  const previous = useRef(value);
  const height = maxWidth ? Math.min(wantedHeight, maxWidth / rowWidth(value, unit)) : wantedHeight;
  const spoken = label ?? (unit ? `${value} ${unitWord[unit]}` : value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (!motion) return;
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
  }, [value, motion, hop]);

  if (!SUPPORTED.test(value)) {
    return (
      <Text variant="display" align="center" accessibilityLabel={spoken} testID={testID}>
        {value}
      </Text>
    );
  }

  const unitHeight = height * UNIT_SCALE;
  return (
    <Animated.View
      accessible
      accessibilityRole="text"
      accessibilityLabel={spoken}
      testID={testID}
      style={[
        styles.row,
        {
          height,
          transform: [
            {
              translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.12] }),
            },
          ],
        },
      ]}
    >
      {parts(value).map((part, index) => {
        const overlap = index === 0 ? 0 : -height * OVERLAP;
        if (part.kind === 'comma') {
          const h = height * COMMA_SCALE;
          return (
            <Image
              key={part.key}
              source={furImages.comma}
              style={{ width: h * furAspect.comma, height: h, marginLeft: overlap / 2 }}
            />
          );
        }
        return (
          <Image
            key={part.key}
            source={furImages.digits[part.digit]}
            style={{ width: height * furAspect.digits[part.digit], height, marginLeft: overlap }}
          />
        );
      })}
      {unit ? (
        <View style={{ marginLeft: height * 0.12 }}>
          <Image
            source={furImages.units[unit]}
            style={{ width: unitHeight * furAspect.units[unit], height: unitHeight }}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
});
