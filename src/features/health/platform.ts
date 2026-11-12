import { Platform } from 'react-native';

import { de } from '@/i18n/de';

/** How the health data source is called on this phone. */
export const healthSourceName =
  Platform.OS === 'ios' ? de.health.source.ios : de.health.source.android;

export const isAndroid = Platform.OS === 'android';
