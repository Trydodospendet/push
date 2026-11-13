import type { IconName } from '@/components';

/** Must match the check constraint of public.user_badges. The server awards them. */
export const BADGE_CODES = [
  'first_challenge',
  'first_win',
  'streak_7',
  'streak_30',
  'km_50',
  'km_100',
  'challenges_10',
] as const;

export type BadgeCode = (typeof BADGE_CODES)[number];

export const BADGE_ICONS: Record<BadgeCode, IconName> = {
  first_challenge: 'flag',
  first_win: 'trophy',
  streak_7: 'flame',
  streak_30: 'bonfire',
  km_50: 'footsteps',
  km_100: 'medal',
  challenges_10: 'ribbon',
};
