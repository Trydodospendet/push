import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components';
import { APP_NAME } from '@/config/app';
import { colors, spacing } from '@/theme';

export function TabHeader() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <Text variant="heading">{APP_NAME}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
});
