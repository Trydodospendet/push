// Carries out what the settlement decided: cancel the reservation (goal reached) or capture it
// (goal missed). Safe to call as often as you like: Stripe's idempotency key is derived from the
// payment and the action, and the database closes a payment only once. A failed attempt is
// retried by the next call (up to 10 times).
//
// Called by a scheduler (every few minutes) with "Authorization: Bearer <SETTLE_PAYMENTS_SECRET>".
import { json, serviceClient, stripeClient } from '../_shared/stripe.ts';

type Action = { payment_id: string; payment_intent_id: string; action: 'cancel' | 'capture' };

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('SETTLE_PAYMENTS_SECRET');
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return json({ error: 'forbidden' }, 403);
  }

  const stripe = stripeClient();
  const db = serviceClient();
  const { data, error } = await db.rpc('rm_pending_actions');
  if (error) {
    return json({ error: error.message }, 500);
  }

  let done = 0;
  let failed = 0;
  for (const item of (data ?? []) as Action[]) {
    let ok = false;
    try {
      const key = `payment-${item.payment_id}-${item.action}`;
      if (item.action === 'capture') {
        await stripe.paymentIntents.capture(item.payment_intent_id, {}, { idempotencyKey: key });
      } else {
        await stripe.paymentIntents.cancel(item.payment_intent_id, {}, { idempotencyKey: key });
      }
      ok = true;
    } catch (caught) {
      // Already captured or cancelled at Stripe counts as done (a retry after a lost answer).
      const code = (caught as { code?: string }).code;
      ok = code === 'payment_intent_unexpected_state';
    }
    await db.rpc('rm_action_done', { p_payment_id: item.payment_id, p_ok: ok });
    if (ok) done += 1;
    else failed += 1;
  }
  return json({ done, failed });
});
