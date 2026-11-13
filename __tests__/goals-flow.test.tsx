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

function goal(overrides: Record<string, unknown> = {}) {
  const startsAt = new Date(Date.now() + DAY);
  return {
    id: 'goal-1',
    creator_id: USER_ID,
    title: '10 km laufen · Woche',
    goal_type: 'run_total',
    target_value: 10000,
    stake_cents: 1000,
    fee_bps: 0,
    timezone: 'Europe/Berlin',
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 7 * DAY).toISOString(),
    sync_grace_hours: 24,
    min_participants: 1,
    max_participants: 1,
    visibility: 'private',
    mode: 'goal',
    invite_code: 'ABC234',
    status: 'open',
    participant_count: 1,
    pot_cents: 1000,
    settled_at: null,
    created_at: '2026-11-12T09:00:00Z',
    ...overrides,
  };
}

function participant(challengeRow: ReturnType<typeof goal>) {
  return {
    challenge_id: challengeRow.id,
    user_id: USER_ID,
    result: 'pending',
    stake_cents: challengeRow.stake_cents,
    payout_cents: null,
    joined_at: '2026-11-12T11:00:00Z',
    profile: { display_name: 'Anna Lauf' },
    challenge: challengeRow,
  };
}

type RpcHandler = (args: Record<string, unknown>) => unknown;

function mockRpc(handlers: Record<string, RpcHandler> = {}) {
  supabaseMock.rpc.mockImplementation(async (fn: string, args: Record<string, unknown> = {}) => {
    if (fn === 'get_my_profile') {
      return { data: profile, error: null };
    }
    if (!handlers[fn] && ['get_my_progress', 'get_pool_overview'].includes(fn)) {
      return { data: [], error: null };
    }
    if (!handlers[fn] && fn === 'get_goal_window') {
      return { data: [{ goals: 3, stakes_cents: 4500 }], error: null };
    }
    const handler = handlers[fn];
    if (!handler) {
      throw new Error(`Unexpected rpc ${fn}`);
    }
    return { data: handler(args), error: null };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockAuth.setInitialSession(createMockSession(USER_ID, 'anna@example.com'));
});

describe('goals', () => {
  it('shows the stake, the return and the binding before anything is booked', async () => {
    const user = userEvent.setup();
    const created = goal();
    mockDb.set({ challenges: [], challenge_participants: [], wallets: { balance_cents: 10000 } });
    mockRpc({
      create_scheduled_goal: () => {
        mockDb.set({
          challenges: [created],
          challenge_participants: [participant(created)],
          wallets: { balance_cents: 9000 },
        });
        return created;
      },
    });

    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByText('Noch kein Ziel')).toBeOnTheScreen();
    await user.press(screen.getAllByRole('button', { name: 'Ziel setzen' })[0]);

    await user.press(await screen.findByRole('radio', { name: 'Gesamtstrecke' }));
    await user.press(screen.getByRole('radio', { name: '10 km' }));
    await user.press(screen.getByRole('radio', { name: 'Nächste Woche' }));
    await user.press(screen.getByRole('radio', { name: '10,00 Credits' }));
    await user.press(screen.getByRole('button', { name: 'Weiter' }));

    // Nothing is booked yet: first the confirmation with all consequences.
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('create_scheduled_goal', expect.anything());
    expect(
      await screen.findByText(
        'Du setzt 10,00 Credits. Der Betrag wird jetzt von deinem Guthaben abgebucht.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/Schaffst du dein Ziel, kommt dein Einsatz am .* zurück/),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Verfehlst du dein Ziel, verfällt dein Einsatz in den Pool.'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Ab dem Start ist der Einsatz gebunden/)).toBeOnTheScreen();
    expect(
      screen.getByText('Testphase: Credits sind virtuell und können nicht ausgezahlt werden.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: '10,00 Credits setzen' }));

    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'create_scheduled_goal',
      expect.objectContaining({
        p_goal_type: 'run_total',
        p_target_value: 10000,
        p_stake_cents: 1000,
        p_start_date: expect.any(String),
        p_end_date: expect.any(String),
        p_with_friends: false,
      }),
    );
    expect(await screen.findByText('TOPF DIESES ZEITRAUMS')).toBeOnTheScreen();
  });

  it('shows the goal of the period pot and lets the owner withdraw it before the start', async () => {
    const user = userEvent.setup();
    const open = goal();
    mockDb.set({
      challenges: [open],
      challenge_participants: [participant(open)],
      wallets: { balance_cents: 9000 },
    });
    mockRpc({ leave_challenge: () => 1000 });

    await renderRouter('./app', { initialUrl: '/challenge/goal-1' });

    expect(await screen.findByText('TOPF DIESES ZEITRAUMS')).toBeOnTheScreen();
    expect(screen.getByText(/in 3 Zielen/)).toBeOnTheScreen();
    expect(screen.queryByText('EINLADUNGSCODE')).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Ziel zurückziehen' }));
    expect(
      await screen.findByText(
        'Du ziehst dein Ziel zurück und bekommst deinen Einsatz von 10,00 Credits sofort zurück.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nach dem Start ist das nicht mehr möglich.')).toBeOnTheScreen();
  });

  it('offers no way back once a goal has started', async () => {
    const running = goal({
      status: 'active',
      starts_at: new Date(Date.now() - DAY).toISOString(),
      ends_at: new Date(Date.now() + 6 * DAY).toISOString(),
    });
    mockDb.set({
      challenges: [running],
      challenge_participants: [participant(running)],
      wallets: { balance_cents: 9000 },
    });
    mockRpc();

    await renderRouter('./app', { initialUrl: '/challenge/goal-1' });

    expect(await screen.findByText('TOPF DIESES ZEITRAUMS')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ziel zurückziehen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Challenge verlassen' })).toBeNull();
  });

  it('shows the most important goal big and further goals in a small overview', async () => {
    const first = goal({
      id: 'goal-a',
      title: 'Wochenziel',
      status: 'active',
      starts_at: new Date(Date.now() - DAY).toISOString(),
      ends_at: new Date(Date.now() + 6 * DAY).toISOString(),
    });
    const second = goal({ id: 'goal-b', title: 'Monatsziel' });
    mockDb.set({
      challenges: [first, second],
      challenge_participants: [participant(first), participant(second)],
    });
    mockRpc({ get_my_progress: () => [{ challenge_id: 'goal-a', progress_value: 4000 }] });

    await renderRouter('./app', { initialUrl: '/' });

    expect(await screen.findByText('WICHTIGSTES ZIEL')).toBeOnTheScreen();
    expect(screen.getByText('WEITERE ZIELE')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Monatsziel/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Challenge finden' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'GPS-Lauf starten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Freunde & Liga' })).toBeNull();
  });
});
