import * as Haptics from 'expo-haptics';

import { getPreferences } from './store';

/**
 * Short vibration feedback. Does nothing when the user switched haptics off, and never throws
 * (some phones have no vibration motor).
 */
function run(task: () => Promise<void>): void {
  if (!getPreferences().haptics) {
    return;
  }
  void task().catch(() => undefined);
}

/** A light tap: choosing something, pressing a button. */
export function hapticTap(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Selection changed (switch, chip). */
export function hapticSelect(): void {
  run(() => Haptics.selectionAsync());
}

/** Something worked: code accepted, goal reached, run saved. */
export function hapticSuccess(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Something went wrong: wrong code, error. */
export function hapticError(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
