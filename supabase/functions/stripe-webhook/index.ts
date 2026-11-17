// Receives Stripe's events. The signature is checked first; every event is processed once
// (the database remembers the event id), so Stripe's retries and duplicates change nothing.
//
// Events: amount_capturable_updated (reservation confirmed -> the goal is created),
// succeeded (captured), canceled (released or expired), payment_failed.
import type Stripe from 'npm:stripe@17';

import { json, serviceClient, stripeClient } from '../_shared/stripe.ts';

const HANDLED = new Set([
  'payment_intent.amount_capturable_updated',
  'payment_intent.succeeded',
  'payment_intent.canceled',
  'payment_intent.payment_failed',
]);

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) {
    return json({ error: 'forbidden' }, 403);
  }

  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return json({ error: 'invalid_signature' }, 400);
  }
  if (!HANDLED.has(event.type)) {
    return json({ received: true, ignored: true });
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const { data, error } = await serviceClient().rpc('rm_apply_intent_event', {
    p_event_id: event.id,
    p_type: event.type,
    p_intent_id: intent.id,
    p_cancel_reason: intent.cancellation_reason ?? null,
  });
  if (error) {
    // Stripe retries on a non-2xx answer.
    return json({ error: error.message }, 500);
  }
  return json({ received: true, result: data });
});
