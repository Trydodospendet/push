import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

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
    mode: 'pool',
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
    if (
      !handlers[fn] &&
      [
        'get_my_progress',
        'get_pool_overview',
        'get_leaderboard',
        'get_challenge_feed',
        'get_my_challenge_result',
      ].includes(fn)
    ) {
      return { data: [], error: null };
    }
    if (!handlers[fn] && fn === 'get_potential_win') {
      return { data: null, error: null };
    }
    const handler = handlers[fn];
    if (!handler) {
      throw new Error(`Unexpected rpc ${fn}`);
    }
    return { data: handler(args), error: null };
  });
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: 'Pool' | 'Ranked') {
  await renderRouter('./app', { initialUrl: '/' });
  await user.press(await screen.findByRole('button', { name }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockAuth.setInitialSession(createMockSession(USER_ID, 'anna@example.com'));
});

describe('pool', () => {
  it('lets everybody choose the own stake when joining', async () => {
    const user = userEvent.setup();
    const open = challenge({ stake_cents: 500 });
    mockDb.set({
      challenges: [open],
      challenge_participants: [participant(open, 'user-2', 'Ben')],
      wallets: { balance_cents: 10000 },
    });
    mockRpc({ join_challenge: () => ({}) });

    await renderRouter('./app', { initialUrl: '/challenge/challenge-1' });
    await user.press(await screen.findByRole('button', { name: 'Beitreten' }));
    await user.press(await screen.findByRole('radio', { name: '20,00 Credits' }));
    expect(screen.getByText(/^Du setzt 20,00 Credits\./)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Jetzt beitreten' }));

    expect(supabaseMock.rpc).toHaveBeenCalledWith('join_challenge', {
      p_challenge_id: 'challenge-1',
      p_stake_cents: 2000,
    });
  });

  it('lists a missed pool as finished and shows the lost stake', async () => {
    const user = userEvent.setup();
    const missed = settled({
      id: 'pool-2',
      creator_id: USER_ID,
      title: 'Mein 10-km-Lauf',
      target_value: 10000,
      min_participants: 1,
      participant_count: 1,
    });
    mockDb.set({
      challenges: [missed],
      challenge_participants: [participant(missed, USER_ID, 'Anna Lauf', 'failed', 0)],
    });
    mockRpc({ get_my_progress: () => [{ challenge_id: missed.id, progress_value: 7200 }] });

    await renderRouter('./app', { initialUrl: '/challenge/pool-2' });

    expect(await screen.findByText('Ziel nicht geschafft.')).toBeOnTheScreen();
    expect(screen.getByText('Dein Einsatz ist verfallen.')).toBeOnTheScreen();
  });
});

describe('ranked', () => {
  it('shows rank, points and the ranking without any money after the settlement', async () => {
    const user = userEvent.setup();
    const done = settled({
      mode: 'ranked',
      stake_cents: 0,
      participant_count: 2,
      pot_cents: 0,
    });
    mockDb.set({
      challenges: [done],
      challenge_participants: [
        participant(done, USER_ID, 'Anna Lauf', 'success', null),
        participant(done, 'user-2', 'Ben', 'failed', null),
      ],
    });
    mockRpc({
      get_leaderboard: () => [
        { rank: 1, user_id: USER_ID, display_name: 'Anna Lauf', is_me: true, goal_reached: true },
        { rank: 2, user_id: 'user-2', display_name: 'Ben', is_me: false, goal_reached: false },
      ],
      get_my_challenge_result: () => [
        { rank: 1, rank_points: 30, payout_cents: null, donated_cents: 0 },
      ],
    });

    await openTab(user, 'Ranked');
    expect(await screen.findByText('ABGESCHLOSSEN')).toBeOnTheScreen();
    await user.press(await screen.findByRole('button', { name: /^5 km am Stück/ }));

    expect(await screen.findByText('Platz 1')).toBeOnTheScreen();
    expect(screen.getByText('30 Punkte für dein Level.')).toBeOnTheScreen();
    expect(await screen.findByText('RANGLISTE')).toBeOnTheScreen();
    expect(await screen.findByLabelText('1. Anna Lauf (du): geschafft')).toBeOnTheScreen();
    expect(screen.getByLabelText('2. Ben: nicht geschafft')).toBeOnTheScreen();
    expect(
      screen.getByText('• In einer Rangliste gibt es keinen Einsatz und keine Credits-Bewegung.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('TOPF')).toBeNull();
  });

  it('keeps pools out of the ranked area and lists only ranked ones', async () => {
    const user = userEvent.setup();
    const ranked = challenge({
      id: 'ranked-1',
      title: 'Team-Lauf',
      mode: 'ranked',
      weekly_key: 'D2026-11-14-km',
      stake_cents: 0,
    });
    const pool = challenge({
      id: 'pool-1',
      creator_id: USER_ID,
      title: 'Nur für mich',
      visibility: 'private',
      min_participants: 1,
    });
    mockDb.set({
      challenges: [ranked, pool],
      challenge_participants: [
        participant(ranked, USER_ID, 'Anna Lauf'),
        participant(pool, USER_ID, 'Anna Lauf'),
      ],
    });
    mockRpc();

    // Start directly in the tab, so Home (which lists both) is not rendered.
    await renderRouter('./app', { initialUrl: '/ranked' });
    // Fixed rankings are grouped by cycle; the daily ranking is listed once.
    expect(await screen.findByText('TÄGLICH')).toBeOnTheScreen();
    expect(await screen.findAllByRole('button', { name: /^Team-Lauf, / })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Nur für mich, / })).toBeNull();

    await user.press(await screen.findByRole('button', { name: 'Profil' }));
    await user.press(await screen.findByRole('button', { name: /^Community-Übersicht\./ }));
    expect(await screen.findByRole('button', { name: /^Nur für mich, / })).toBeOnTheScreen();
  });
});
