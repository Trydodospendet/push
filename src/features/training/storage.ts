import { z } from 'zod';

import { secureStorage } from '@/lib/secure-storage';

import { planById, type PlanId } from './plans';

/** The plan a user follows. Kept on this phone only (like the reminder settings). */
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const storedSchema = z.union([
  z.object({ planId: z.string(), startDate: localDate, firstRunOffset: z.literal(1).optional() }),
  z.object({ planId: z.string(), startMonday: localDate }).transform(({ planId, startMonday }) => ({
    planId,
    startDate: startMonday,
    firstRunOffset: 1 as const,
  })),
]);

export type ActivePlan = { planId: PlanId; startDate: string; firstRunOffset?: 1 };

const key = (userId: string) => `push.training.${userId}`;

export async function loadActivePlan(userId: string): Promise<ActivePlan | null> {
  try {
    const raw = await secureStorage.getItem(key(userId));
    if (raw === null) {
      return null;
    }
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return null;
    }
    const template = planById(parsed.data.planId);
    return template ? { ...parsed.data, planId: template.id } : null;
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
