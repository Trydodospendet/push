import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components';
import { APP_NAME, DEFAULT_TIMEZONE } from '@/config/app';
import { useClock } from '@/features/gps/use-clock';
import { colors, fontFamily, layout, spacing } from '@/theme';

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: DEFAULT_TIMEZONE,
});

/** Top bar of the tabs: the name of the app on the left, today's date on the right. */
export function GoalHeader() {
  const now = useClock(true);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.logo}>{APP_NAME}</Text>
        <Text variant="caption" color="textSecondary">
          {dateFormat.format(new Date(now))}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  logo: { fontFamily: fontFamily.extraBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
});
