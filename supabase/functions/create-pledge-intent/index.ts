// Creates the card reservation for a pledge: a PaymentIntent with capture_method=manual
// (the money is only reserved, nothing is charged) and returns what the app's PaymentSheet needs.
// The goal itself is created later by the stripe-webhook function, once Stripe reports the
// confirmed reservation.
//
// Called by the app with the user's JWT. Refuses everything while the server switch
// private.settings.real_money_enabled is off or the user is not on the tester list.
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  STRIPE_API_VERSION,
  json,
  serviceClient,
  stripeClient,
  validStake,
} from '../_shared/stripe.ts';

type Goal = {
  title: string;
  goal_type: string;
  target_value: number;
  start_date: string;
  end_date: string;
  ngo_id?: string | null;
};

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  const authorization = request.headers.get('Authorization') ?? '';
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'not_authenticated' }, 401);
  }
  const user = userData.user;

  const { data: allowed } = await userClient.rpc('get_real_money_status');
  if (allowed !== true) {
    return json({ error: 'real_money_disabled' }, 403);
  }

  let body: { stake_cents?: unknown; goal?: Goal };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const goal = body.goal;
  if (!validStake(body.stake_cents) || !goal || typeof goal.title !== 'string') {
    return json({ error: 'invalid_stake' }, 400);
  }

  const stripe = stripeClient();
  const db = serviceClient();

  // One Stripe customer per user.
  const { data: existing } = await db
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  let customerId = existing?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { user_id: user.id } });
    customerId = customer.id;
    await db.from('stripe_customers').upsert({ user_id: user.id, stripe_customer_id: customerId });
  }

  const intent = await stripe.paymentIntents.create({
    amount: body.stake_cents,
    currency: 'eur',
    customer: customerId,
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true },
    description: 'PUSH Pfand (Reservierung)',
    metadata: { user_id: user.id },
  });

  const { error: registerError } = await db.rpc('rm_register_payment', {
    p_user_id: user.id,
    p_intent_id: intent.id,
    p_amount_cents: body.stake_cents,
    p_goal: { ...goal, with_friends: false },
  });
  if (registerError) {
    await stripe.paymentIntents.cancel(intent.id);
    return json({ error: registerError.message }, 400);
  }

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: STRIPE_API_VERSION },
  );

  return json({
    clientSecret: intent.client_secret,
    customerId,
    ephemeralKey: ephemeralKey.secret,
    paymentIntentId: intent.id,
  });
});
