import type { TextStyle } from 'react-native';

import { fontFamily } from './fonts';

export const typography = {
  /** Big key figures and the logo: 56–72 pt, weight 800, tabular numbers. */
  display: {
    fontFamily: fontFamily.extraBold,
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: fontFamily.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Small uppercase headings with tracking, e.g. "TODAY'S CHALLENGE". */
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    lineHeight: 20,
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
