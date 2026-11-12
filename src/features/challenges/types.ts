import type { Database } from '@/lib/database.types';

export type Challenge = Database['public']['Tables']['challenges']['Row'];
export type ChallengeParticipantRow = Database['public']['Tables']['challenge_participants']['Row'];

export type ChallengeStatus = 'open' | 'active' | 'settling' | 'settled' | 'cancelled';

/** Participant as shown in the list on the detail screen. */
export type Participant = {
  userId: string;
  displayName: string;
  result: string;
  stakeCents: number;
  /** Set by the server when the challenge is settled or cancelled. */
  payoutCents: number | null;
};

/** One row of the ranking of a ranked challenge (no progress values of others). */
export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  isMe: boolean;
  goalReached: boolean;
};

/** A challenge in "my challenges", with how the user is involved. */
export type MyChallenge = Challenge & { isParticipant: boolean; isCreator: boolean };
