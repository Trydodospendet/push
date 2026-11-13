import { StyleSheet } from 'react-native';

import { Card, Screen, SwitchRow, Text } from '@/components';
import { hapticSelect } from '@/features/preferences/haptics';
import { setPreference, usePreferences } from '@/features/preferences/store';
import { de } from '@/i18n/de';
import { spacing } from '@/theme';

const SCREEN_EDGES = ['bottom', 'left', 'right'] as const;

/** Animations and haptic feedback on or off (only on this phone). */
export default function AppearanceScreen() {
  const preferences = usePreferences();

  return (
    <Screen scroll edges={SCREEN_EDGES} contentStyle={styles.content}>
      <Card style={styles.card}>
        <Text variant="label" color="textSecondary">
          {de.appearance.label}
        </Text>
        <SwitchRow
          label={de.appearance.animations}
          hint={de.appearance.animationsHint}
          value={preferences.animations}
          onChange={(value) => {
            hapticSelect();
            void setPreference('animations', value);
          }}
        />
        <SwitchRow
          label={de.appearance.haptics}
          hint={de.appearance.hapticsHint}
          value={preferences.haptics}
          onChange={(value) => {
            void setPreference('haptics', value);
            if (value) {
              hapticSelect();
            }
          }}
        />
        <SwitchRow
          label={de.appearance.voice}
          hint={de.appearance.voiceHint}
          value={preferences.voice}
          onChange={(value) => {
            hapticSelect();
            void setPreference('voice', value);
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
});
