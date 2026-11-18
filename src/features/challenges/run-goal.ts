import type { MyChallenge } from '@/features/challenges/types';

/**
 * True when the user has a run goal that is not over yet (open or running). Runs only count
 * for such a goal, so the app asks for one before it records a run.
 */
export function hasRunGoal(challenges: readonly MyChallenge[], now: number): boolean {
  return challenges.some(
    (challenge) =>
      challenge.isParticipant &&
      challenge.goal_type.startsWith('run') &&
      (challenge.status === 'open' || challenge.status === 'active') &&
      Date.parse(challenge.ends_at) > now,
  );
}
