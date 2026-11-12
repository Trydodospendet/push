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
};

/** A challenge in "my challenges", with how the user is involved. */
export type MyChallenge = Challenge & { isParticipant: boolean; isCreator: boolean };
