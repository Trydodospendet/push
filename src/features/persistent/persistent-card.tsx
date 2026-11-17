import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Card, SwitchRow, Text } from '@/components';
import { de } from '@/i18n/de';
import { hapticSelect } from '@/features/preferences/haptics';
import { setPreference, usePreferences } from '@/features/preferences/store';
import { requestPermission } from '@/features/reminders/notifications';
import { spacing } from '@/theme';

import { persistentSupported } from './notification';

/** Setting "Fortschritt dauerhaft anzeigen" (permanent, quiet Android notification). */
export function PersistentCard() {
  const { persistentProgress } = usePreferences();
  const [denied, setDenied] = useState(false);

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.persistent.label}
      </Text>
      <SwitchRow
        label={de.persistent.toggle}
        hint={persistentSupported ? de.persistent.hint : de.persistent.iosHint}
        value={persistentProgress}
        disabled={!persistentSupported}
        onChange={(value) => {
          hapticSelect();
          if (!value) {
            setDenied(false);
            void setPreference('persistentProgress', false);
            return;
          }
          void requestPermission()
            .then((state) => {
              setDenied(state !== 'granted');
              if (state === 'granted') void setPreference('persistentProgress', true);
            })
            .catch(() => setDenied(true));
        }}
      />
      {denied ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {de.persistent.denied}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
