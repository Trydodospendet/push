import { z } from 'zod';

import { secureStorage } from '@/lib/secure-storage';

import { planById, type PlanId } from './plans';

/** The plan a user follows. Kept on this phone only (like the reminder settings). */
const storedSchema = z.object({
  planId: z.string(),
  /** Local date 'YYYY-MM-DD' of the Monday of week 1. */
  startMonday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ActivePlan = { planId: PlanId; startMonday: string };

const key = (userId: string) => `push.training.${userId}`;

export async function loadActivePlan(userId: string): Promise<ActivePlan | null> {
  try {
    const raw = await secureStorage.getItem(key(userId));
    if (raw === null) {
      return null;
    }
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !planById(parsed.data.planId)) {
      return null;
    }
    return { planId: parsed.data.planId as PlanId, startMonday: parsed.data.startMonday };
  } catch {
    return null;
  }
}

export async function saveActivePlan(userId: string, plan: ActivePlan | null): Promise<void> {
  if (plan === null) {
    await secureStorage.removeItem(key(userId));
    return;
  }
  await secureStorage.setItem(key(userId), JSON.stringify(plan));
}
