// Shared helpers of the real-money Edge Functions (Deno runtime, Supabase Edge Functions).
// Keys come from Supabase secrets only: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

export const STAKE_MIN_CENTS = 100;
export const STAKE_MAX_CENTS = 5000;
export const STRIPE_API_VERSION = '2025-02-24.acacia';

/** Stripe client. Live keys are refused unless STRIPE_ALLOW_LIVE=yes was set on purpose. */
export function stripeClient(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  if (!key.startsWith('sk_test_') && Deno.env.get('STRIPE_ALLOW_LIVE') !== 'yes') {
    throw new Error('stripe_live_key_not_allowed');
  }
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/** Service-role client: bypasses RLS, so it is used only inside these functions. */
export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** True for a plausible amount in cents (whole number between 1 and 50 euros). */
export function validStake(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= STAKE_MIN_CENTS &&
    value <= STAKE_MAX_CENTS
  );
}
