import { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { Art, Button, Screen, Text } from '@/components';
import { healthSourceName } from '@/features/health/platform';
import { de } from '@/i18n/de';
import { colors, radius, spacing } from '@/theme';

export type IntroPagerProps = {
  /** Called by "Los geht's" on the last page and by "Überspringen". */
  onFinish: () => void;
};

/** Swipeable pages: how it works, automatic checking, pool, ranked, donations. */
export function IntroPager({ onFinish }: IntroPagerProps) {
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const pages = de.intro.pages(healthSourceName);
  const last = index === pages.length - 1;

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (last) {
      onFinish();
      return;
    }
    scroll.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.skipRow}>
        {last ? null : <Button label={de.intro.skip} variant="secondary" onPress={onFinish} />}
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pages}
      >
        {pages.map((page, pageIndex) => (
          <View
            key={page.title}
            style={[styles.page, { width }]}
            accessible
            accessibilityLabel={`${de.intro.pageOf(pageIndex + 1, pages.length)}. ${page.title}. ${page.text}`}
          >
            <Art name={page.art} size={176} />
            <View style={styles.texts}>
              <Text variant="title" align="center" accessibilityRole="header">
                {page.title}
              </Text>
              <Text color="textSecondary" align="center">
                {page.text}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots} accessibilityElementsHidden>
          {pages.map((page, dotIndex) => (
            <View key={page.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
        <Button label={last ? de.intro.start : de.intro.next} onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    gap: spacing.md,
  },
  skipRow: {
    alignItems: 'flex-end',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  pages: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  texts: {
    gap: spacing.sm,
  },
  footer: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: spacing.lg,
    backgroundColor: colors.accent,
  },
});
