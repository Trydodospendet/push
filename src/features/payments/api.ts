import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { z } from 'zod';

import type { CreateGoalInput } from '@/features/challenges/schemas';
import { invalidateAfterBooking } from '@/features/challenges/api';
import { supabase } from '@/lib/supabase';

export const paymentKeys = {
  all: ['payments'] as const,
  status: (userId: string) => [...paymentKeys.all, 'status', userId] as const,
  list: (userId: string) => [...paymentKeys.all, 'list', userId] as const,
};

export type PaymentStatus = 'pending' | 'reserved' | 'released' | 'captured' | 'failed' | 'expired';

export type Payment = {
  id: string;
  amountCents: number;
  status: PaymentStatus;
  challengeId: string | null;
  createdAt: string;
};

const paymentRowSchema = z.object({
  id: z.string(),
  amount_cents: z.number(),
  status: z.enum(['pending', 'reserved', 'released', 'captured', 'failed', 'expired']),
  challenge_id: z.string().nullable(),
  payment_intent_id: z.string(),
  created_at: z.string(),
});

const intentSchema = z.object({
  clientSecret: z.string(),
  customerId: z.string(),
  ephemeralKey: z.string(),
  paymentIntentId: z.string(),
});

// The generated database types do not know the payments table and the status function of
// 20261202100000_real_money.sql yet; answers are validated with zod instead of trusted.
type Untyped = {
  rpc: (name: string) => PromiseLike<{ data: unknown; error: Error | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => PromiseLike<{ data: unknown; error: Error | null }>;
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: Error | null }>;
      };
    };
  };
};
const untyped = supabase as unknown as Untyped;

/**
 * Whether real money is switched on for this user on the server. Any problem counts as "off", so
 * the app never offers a card payment by mistake.
 */
export function useRealMoneyStatus(userId: string) {
  return useQuery({
    queryKey: paymentKeys.status(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await untyped.rpc('get_real_money_status');
      return !error && data === true;
    },
  });
}

/** The user's own reservations and payments, newest first. */
export function useMyPayments(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: paymentKeys.list(userId),
    enabled,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await untyped
        .from('payments')
        .select('id, amount_cents, status, challenge_id, payment_intent_id, created_at')
        .order('created_at', { ascending: false });
      if (error) {
        throw error;
      }
      return z
        .array(paymentRowSchema)
        .parse(data)
        .map((row) => ({
          id: row.id,
          amountCents: row.amount_cents,
          status: row.status,
          challengeId: row.challenge_id,
          createdAt: row.created_at,
        }));
    },
  });
}

export class PaymentCancelledError extends Error {
  constructor() {
    super('payment_cancelled');
  }
}

const POLL_MS = 1500;
const POLL_TIMES = 20;

/**
 * Reserves the pledge on the card and waits until the server has created the goal (Stripe tells
 * it by webhook). Nothing is charged: the money is only held until the goal is settled.
 * Resolves to the id of the new goal.
 */
export function useReserveGoal(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGoalInput): Promise<string> => {
      const { data, error } = await supabase.functions.invoke('create-pledge-intent', {
        body: {
          stake_cents: input.stakeCents,
          goal: {
            title: input.title,
            goal_type: input.goalType,
            target_value: input.targetValue,
            start_date: input.startDate,
            end_date: input.endDate,
            ngo_id: input.ngoId ?? null,
          },
        },
      });
      if (error) {
        throw error;
      }
      const intent = intentSchema.parse(data);

      const init = await initPaymentSheet({
        merchantDisplayName: 'PUSH',
        customerId: intent.customerId,
        customerEphemeralKeySecret: intent.ephemeralKey,
        paymentIntentClientSecret: intent.clientSecret,
        allowsDelayedPaymentMethods: false,
        applePay: { merchantCountryCode: 'DE' },
        googlePay: { merchantCountryCode: 'DE', currencyCode: 'EUR', testEnv: true },
      });
      if (init.error) {
        throw new Error(init.error.message);
      }
      const presented = await presentPaymentSheet();
      if (presented.error) {
        if (presented.error.code === 'Canceled') {
          throw new PaymentCancelledError();
        }
        throw new Error(presented.error.message);
      }

      for (let attempt = 0; attempt < POLL_TIMES; attempt += 1) {
        const { data: row, error: pollError } = await untyped
          .from('payments')
          .select('id, amount_cents, status, challenge_id, payment_intent_id, created_at')
          .eq('payment_intent_id', intent.paymentIntentId)
          .maybeSingle();
        if (pollError) {
          throw pollError;
        }
        const parsed = paymentRowSchema.nullable().parse(row);
        if (parsed?.status === 'reserved' && parsed.challenge_id) {
          return parsed.challenge_id;
        }
        if (parsed?.status === 'failed') {
          throw new Error('reservation_failed');
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      throw new Error('reservation_pending');
    },
    onSettled: () => {
      invalidateAfterBooking(queryClient);
      void queryClient.invalidateQueries({ queryKey: paymentKeys.list(userId) });
    },
  });
}
