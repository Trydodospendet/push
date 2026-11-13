import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DEFAULT_TIMEZONE } from '@/config/app';
import { addDays, toLocalDate } from '@/lib/dates';
import { useMyWorkouts } from '@/features/health/api';

import { planById, sessionStates, sessionsOf, type SessionState } from './plans';
import { loadActivePlan, saveActivePlan, type ActivePlan } from './storage';

const planKey = (userId: string) => ['training-plan', userId] as const;

export function useActivePlan(userId: string) {
  return useQuery({ queryKey: planKey(userId), queryFn: () => loadActivePlan(userId) });
}

export function useSetActivePlan(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (plan: ActivePlan | null) => {
      await saveActivePlan(userId, plan);
      return plan;
    },
    onSuccess: (plan) => client.setQueryData(planKey(userId), plan),
  });
}

/** The sessions of the active plan with done/open, from the valid runs on the server. */
export function useTrainingSessions(userId: string, plan: ActivePlan | null | undefined) {
  const template = plan ? planById(plan.planId) : undefined;
  const from = plan?.startMonday ?? '2000-01-01';
  const until = template ? addDays(from, template.weeks * 7) : from;
  // One day of slack on both sides, so the local days at the edges are complete.
  const workouts = useMyWorkouts(
    userId,
    `${addDays(from, -1)}T00:00:00Z`,
    `${addDays(until, 1)}T00:00:00Z`,
    template !== undefined,
  );

  const sessions: SessionState[] | undefined =
    plan && template && workouts.data
      ? sessionStates(
          sessionsOf(template, plan.startMonday),
          workouts.data.map((run) => ({
            localDate: toLocalDate(new Date(run.startAt), DEFAULT_TIMEZONE),
            distanceM: run.distanceM,
            isValid: run.isValid,
          })),
          plan.startMonday,
        )
      : undefined;

  return {
    sessions,
    isPending: workouts.isPending,
    isError: workouts.isError,
    refetch: workouts.refetch,
  };
}
