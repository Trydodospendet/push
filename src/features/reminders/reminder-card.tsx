import { useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Text } from '@/components';
import { de } from '@/i18n/de';
import { colors, layout, spacing } from '@/theme';

import { useReminders } from './reminder-provider';

const pad = (value: number) => String(value).padStart(2, '0');
const MINUTE_STEP = 15;

/** Daily reminder on/off and time; the time is chosen with four buttons (no extra library). */
export function ReminderCard() {
  const reminders = useReminders();
  const { settings } = reminders;
  const [busy, setBusy] = useState(false);

  const shift = (hourDelta: number, minuteDelta: number) => {
    const total =
      (settings.hour * 60 + settings.minute + hourDelta * 60 + minuteDelta + 1440) % 1440;
    void reminders.setTime(Math.floor(total / 60), total % 60);
  };

  return (
    <Card style={styles.card}>
      <Text variant="label" color="textSecondary">
        {de.reminders.label}
      </Text>
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text>{de.reminders.toggle}</Text>
          <Text variant="caption" color="textMuted">
            {de.reminders.toggleHint}
          </Text>
        </View>
        <Switch
          value={settings.enabled}
          disabled={busy || !reminders.ready}
          accessibilityLabel={de.reminders.toggle}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.text}
          onValueChange={(value) => {
            setBusy(true);
            void reminders.setEnabled(value).finally(() => setBusy(false));
          }}
        />
      </View>
      {reminders.permission === 'denied' && !settings.enabled ? (
        <>
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {de.reminders.deniedHint}
          </Text>
          <Button
            label={de.reminders.openSettings}
            variant="secondary"
            onPress={() => void Linking.openSettings()}
          />
        </>
      ) : null}
      {settings.enabled ? (
        <View style={styles.timeRow}>
          <Text color="textSecondary">{de.reminders.timeLabel}</Text>
          <View style={styles.stepper}>
            <View style={styles.stepButton}>
              <Button
                label="−"
                accessibilityLabel={de.reminders.hourDown}
                variant="secondary"
                onPress={() => shift(-1, 0)}
              />
            </View>
            <View style={styles.stepButton}>
              <Button
                label="+"
                accessibilityLabel={de.reminders.hourUp}
                variant="secondary"
                onPress={() => shift(1, 0)}
              />
            </View>
          </View>
          <Text variant="heading" style={styles.statValue}>
            {de.reminders.time(pad(settings.hour), pad(settings.minute))}
          </Text>
          <View style={styles.stepper}>
            <View style={styles.stepButton}>
              <Button
                label="−"
                accessibilityLabel={de.reminders.minuteDown}
                variant="secondary"
                onPress={() => shift(0, -MINUTE_STEP)}
              />
            </View>
            <View style={styles.stepButton}>
              <Button
                label="+"
                accessibilityLabel={de.reminders.minuteUp}
                variant="secondary"
                onPress={() => shift(0, MINUTE_STEP)}
              />
            </View>
          </View>
        </View>
      ) : null}
      <Text variant="caption" color="textMuted">
        {de.reminders.localOnlyHint}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xxs,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
  },
  toggleText: {
    flex: 1,
  },
  timeRow: {
    gap: spacing.sm,
  },
  stepButton: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
