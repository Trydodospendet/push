import { APP_NAME } from '@/config/app';

/** All user-facing texts of the app. Screens and components never hard-code strings. */
export const de = {
  common: {
    loading: 'Wird geladen',
  },
  welcome: {
    logo: `${APP_NAME}.`,
    claim: 'YOUR GOALS. YOUR STAKES.',
    start: 'Loslegen',
  },
} as const;
