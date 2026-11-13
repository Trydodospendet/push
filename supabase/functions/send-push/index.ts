// Sends the messages waiting in public.push_outbox through Expo's push service.
//
// NOT DEPLOYED. Setup is described in docs/PUSH.md. The function is called every minute (pg_cron
// + pg_net, or a scheduled trigger) with the header "Authorization: Bearer <SEND_PUSH_SECRET>".
// It uses the service role key from the function's environment and never sends anything but
// the title, the text and a deep link.
//
// Deno runtime (Supabase Edge Functions).
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

type OutboxRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type Ticket = { status: 'ok' | 'error'; message?: string; details?: { error?: string } };

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('SEND_PUSH_SECRET');
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: rows, error } = await supabase
    .from('push_outbox')
    .select('id, user_id, title, body, data')
    .is('sent_at', null)
    .is('error', null)
    .order('created_at')
    .limit(BATCH);
  if (error) {
    return new Response(error.message, { status: 500 });
  }
  const outbox = (rows ?? []) as OutboxRow[];
  if (outbox.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', [...new Set(outbox.map((row) => row.user_id))]);
  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows ?? []) {
    tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row.token]);
  }

  // One Expo message per token; remember which outbox row and token each belongs to.
  const messages: { to: string; title: string; body: string; data: unknown; sound: string; channelId: string }[] = [];
  const owners: { rowId: string; token: string }[] = [];
  for (const row of outbox) {
    for (const token of tokensByUser.get(row.user_id) ?? []) {
      messages.push({ to: token, title: row.title, body: row.body, data: row.data, sound: 'default', channelId: 'default' });
      owners.push({ rowId: row.id, token });
    }
  }

  let tickets: Ticket[] = [];
  if (messages.length > 0) {
    const response = await fetch(EXPO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      return new Response(`expo ${response.status}`, { status: 502 });
    }
    tickets = ((await response.json()) as { data: Ticket[] }).data;
  }

  const failedRows = new Map<string, string>();
  const deadTokens: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket.status === 'error') {
      failedRows.set(owners[index].rowId, ticket.details?.error ?? ticket.message ?? 'error');
      if (ticket.details?.error === 'DeviceNotRegistered') {
        deadTokens.push(owners[index].token);
      }
    }
  });

  const now = new Date().toISOString();
  for (const row of outbox) {
    await supabase
      .from('push_outbox')
      .update(failedRows.has(row.id) ? { error: failedRows.get(row.id) } : { sent_at: now })
      .eq('id', row.id);
  }
  if (deadTokens.length > 0) {
    await supabase.from('push_tokens').delete().in('token', deadTokens);
  }

  return new Response(JSON.stringify({ sent: outbox.length - failedRows.size, failed: failedRows.size }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
