import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import { addDays, toLocalDate } from '@/lib/dates';

jest.mock('@/lib/supabase');
jest.mock('@/features/health/storage');
jest.mock('@/features/intro/storage');
jest.mock('@/features/health/native');
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));

const {
  createMockSession,
  mockAuth,
  mockDb,
  supabase: supabaseMock,
} = jest.requireMock<typeof import('../src/lib/__mocks__/supabase')>('@/lib/supabase');

const USER_ID = 'user-1';
const DAY = 24 * 60 * 60 * 1000;
const tomorrow = addDays(toLocalDate(new Date(), 'Europe/Berlin'), 1);

const profile = {
  id: USER_ID,
  display_name: 'Anna Lauf',
  timezone: 'Europe/Berlin',
  onboarded_at: '2026-11-12T10:00:00Z',
  created_at: '2026-11-12T09:00:00Z',
};

function challenge(overrides: Record<string, unknown> = {}) {
  const startsAt = new Date(Date.now() + DAY);
  return {
    id: 'challenge-1',
    creator_id: 'user-2',
    title: '5 km am Stück',
    goal_type: 'run_single',
    target_value: 5000,
    stake_cents: 1000,
    fee_bps: 0,
    timezone: 'Europe/Berlin',
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 7 * DAY).toISOString(),
    sync_grace_hours: 24,
    min_participants: 2,
    max_participants: null,
    visibility: 'public',
    mode: 'ranked',
    invite_code: null,
    status: 'open',
    participant_count: 1,
    pot_cents: 1000,
    settled_at: null,
    created_at: '2026-11-12T09:00:00Z',
    ...overrides,
  };
}

/** A challenge that ended 10 days ago and was settled. */
function settled(overrides: Record<string, unknown> = {}) {
  return challenge({
    status: 'settled',
    starts_at: new Date(Date.now() - 17 * DAY).toISOString(),
    ends_at: new Date(Date.now() - 10 * DAY).toISOString(),
    settled_at: new Date(Date.now() - 9 * DAY).toISOString(),
    ...overrides,
  });
}

function participant(
  challengeRow: ReturnType<typeof challenge>,
  userId: string,
  name: string,
  result = 'pending',
  payoutCents: number | null = null,
) {
  return {
    challenge_id: challengeRow.id,
    user_id: userId,
    result,
    stake_cents: challengeRow.stake_cents,
    payout_cents: payoutCents,
    joined_at: '2026-11-12T11:00:00Z',
    profile: { display_name: name },
    challenge: challengeRow,
  };
}

type RpcHandler = (args: Record<string, unknown>) => unknown;

function mockRpc(handlers: Record<string, RpcHandler> = {}) {
  supabaseMock.rpc.mockImplementation(async (fn: string, args: Record<string, unknown> = {}) => {
    if (fn === 'get_my_profile') {
      return { data: profile, error: null };
    }
    if (fn === 'get_my_progress' && !handlers[fn]) {
      return { data: [], error: null };
    }
    const handler = handlers[fn];
    if (!handler) {
      throw new Error(`Unexpected rpc ${fn}`);
    }
    return { data: handler(args), error: null };
  });
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: 'Solo' | 'Ranked') {
  await renderRouter('./app', { initialUrl: '/' });
  await user.press(await screen.findByRole('button', { name }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockAuth.setInitialSession(createMockSession(USER_ID, 'anna@example.com'));
});

describe('solo', () => {
  it('sets a solo goal only after confirming the stake', async () => {
    const user = userEvent.setup();
    const created = challenge({
      id: 'solo-1',
      creator_id: USER_ID,
      title: '5 km am Stück',
      stake_cents: 500,
      mode: 'solo',
      visibility: 'private',
      min_participants: 1,
      max_participants: 1,
      pot_cents: 500,
    });
    mockDb.set({ challenges: [], challenge_participants: [], wallets: { balance_cents: 10000 } });
    mockRpc({
      create_challenge: () => {
        mockDb.set({
          challenges: [created],
          challenge_participants: [participant(created, USER_ID, 'Anna Lauf')],
          wallets: { balance_cents: 9500 },
        });
        return created;
      },
    });

    await openTab(user, 'Solo');
    expect(await screen.findByText('Kein Ziel gesetzt')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Solo-Ziel setzen' }));
    await user.press(await screen.findByRole('radio', { name: '5,00 Credits' }));
    expect(screen.queryByRole('radio', { name: 'Öffentlich' })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Weiter zum Einsatz' }));
    expect(
      await screen.findByText(
        'Du setzt 5,00 Credits auf dich selbst. Erreichst du dein Ziel, bekommst du sie zurück. Sonst verfallen sie.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Testphase: Credits sind virtuell und können nicht ausgezahlt werden.'),
    ).toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('create_challenge', expect.anything());

    await user.press(screen.getByRole('button', { name: 'Einsatz setzen' }));
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_challenge', {
      p_title: '5 km am Stück',
      p_goal_type: 'run_single',
      p_target_value: 5000,
      p_stake_cents: 500,
      p_start_date: tomorrow,
      p_duration_days: 7,
      p_visibility: 'private',
      p_mode: 'solo',
    });

    expect(
      await screen.findByText('• Schaffst du es nicht, verfällt dein Einsatz.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('WER IST DABEI')).toBeNull();
    expect(screen.queryByText('TOPF')).toBeNull();
    expect(screen.getByRole('button', { name: 'Challenge verlassen' })).toBeOnTheScreen();
  });

  it('lists a missed solo goal as finished and shows the lost stake', async () => {
    const user = userEvent.setup();
    const missed = settled({
      id: 'solo-2',
      creator_id: USER_ID,
      title: 'Mein 10-km-Lauf',
      target_value: 10000,
      mode: 'solo',
      visibility: 'private',
      min_participants: 1,
      max_participants: 1,
    });
    mockDb.set({
      challenges: [missed],
      challenge_participants: [participant(missed, USER_ID, 'Anna Lauf', 'failed', 0)],
    });
    mockRpc({ get_my_progress: () => [{ challenge_id: missed.id, progress_value: 7200 }] });

    await openTab(user, 'Solo');
    expect(await screen.findByText('Kein Ziel gesetzt')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: /^Mein 10-km-Lauf/ }));

    expect(await screen.findByText('Ziel nicht geschafft.')).toBeOnTheScreen();
    expect(screen.getByText('Dein Einsatz ist verfallen.')).toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('get_leaderboard', expect.anything());
  });
});

describe('ranked', () => {
  it('shows the ranking and the payout after the settlement', async () => {
    const user = userEvent.setup();
    const done = settled({ fee_bps: 1000, participant_count: 2, pot_cents: 2000 });
    mockDb.set({
      challenges: [done],
      challenge_participants: [
        participant(done, USER_ID, 'Anna Lauf', 'success', 1900),
        participant(done, 'user-2', 'Ben', 'failed', 0),
      ],
    });
    mockRpc({
      get_leaderboard: () => [
        { rank: 1, user_id: USER_ID, display_name: 'Anna Lauf', is_me: true, goal_reached: true },
        { rank: 2, user_id: 'user-2', display_name: 'Ben', is_me: false, goal_reached: false },
      ],
    });

    await openTab(user, 'Ranked');
    expect(await screen.findByText('ABGESCHLOSSEN')).toBeOnTheScreen();
    expect(
      screen.getByText('Tritt einer offenen Challenge bei oder tippe oben auf „Erstellen“.'),
    ).toBeOnTheScreen();
    await user.press(await screen.findByRole('button', { name: /^5 km am Stück/ }));

    expect(await screen.findByText('Ziel geschafft!')).toBeOnTheScreen();
    expect(screen.getByText('Dir wurden 19,00 Credits gutgeschrieben.')).toBeOnTheScreen();
    expect(await screen.findByText('RANGLISTE')).toBeOnTheScreen();
    expect(await screen.findByLabelText('1. Anna Lauf (du): geschafft')).toBeOnTheScreen();
    expect(screen.getByLabelText('2. Ben: nicht geschafft')).toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_leaderboard', {
      p_challenge_id: done.id,
    });
    expect(
      screen.getByText(/^• Von den verlorenen Einsätzen gehen 10\s%\sGebühr ab\.$/),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Die Rangliste zeigt nur die Reihenfolge – ausgezahlt wird nicht nach Platz.',
      ),
    ).toBeOnTheScreen();
  });

  it('keeps solo goals out of the ranked area and lists only ranked ones', async () => {
    const user = userEvent.setup();
    const ranked = challenge({ id: 'ranked-1', title: 'Team-Lauf' });
    const solo = challenge({
      id: 'solo-1',
      creator_id: USER_ID,
      title: 'Nur für mich',
      mode: 'solo',
      visibility: 'private',
      min_participants: 1,
      max_participants: 1,
    });
    mockDb.set({
      challenges: [ranked, solo],
      challenge_participants: [
        participant(ranked, USER_ID, 'Anna Lauf'),
        participant(solo, USER_ID, 'Anna Lauf'),
      ],
    });
    mockRpc();

    // Start directly in the tab, so Home (which lists both) is not rendered.
    await renderRouter('./app', { initialUrl: '/ranked' });
    // Once under "Meine Challenges", once under "Offene Challenges".
    expect(await screen.findAllByRole('button', { name: /^Team-Lauf, / })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Nur für mich, / })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Solo' }));
    expect(await screen.findByRole('button', { name: /^Nur für mich, / })).toBeOnTheScreen();
  });
});
