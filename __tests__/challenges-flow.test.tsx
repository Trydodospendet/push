import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/lib/supabase');
jest.mock('@/features/health/storage');
jest.mock('@/features/intro/storage');
jest.mock('@/features/health/native');
// Font loading is not part of these tests (and expo-font needs native asset modules).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));

const {
  createMockSession,
  mockAuth,
  mockDb,
  supabase: supabaseMock,
} = jest.requireMock<typeof import('../src/lib/__mocks__/supabase')>('@/lib/supabase');

const USER_ID = 'user-1';
const session = createMockSession(USER_ID, 'anna@example.com');

const profile = {
  id: USER_ID,
  display_name: 'Anna Lauf',
  timezone: 'Europe/Berlin',
  onboarded_at: '2026-11-12T10:00:00Z',
  created_at: '2026-11-12T09:00:00Z',
};

function challenge(overrides: Record<string, unknown> = {}) {
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
    ends_at: new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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

function participant(challengeRow: ReturnType<typeof challenge>, userId: string, name: string) {
  return {
    challenge_id: challengeRow.id,
    user_id: userId,
    result: 'pending',
    stake_cents: challengeRow.stake_cents,
    joined_at: '2026-11-12T11:00:00Z',
    profile: { display_name: name },
    challenge: challengeRow,
  };
}

type RpcHandler = (args: Record<string, unknown>) => unknown;

/** Routes supabase.rpc calls by function name; get_my_profile always works. */
function mockRpc(handlers: Record<string, RpcHandler> = {}) {
  supabaseMock.rpc.mockImplementation(async (fn: string, args: Record<string, unknown> = {}) => {
    if (fn === 'get_my_profile') {
      return { data: profile, error: null };
    }
    if ((fn === 'get_my_progress' || fn === 'get_pool_overview') && !handlers[fn]) {
      return { data: [], error: null };
    }
    const handler = handlers[fn];
    if (!handler) {
      throw new Error(`Unexpected rpc ${fn}`);
    }
    return { data: handler(args), error: null };
  });
}

async function openChallenge(id: string) {
  await renderRouter('./app', { initialUrl: `/challenge/${id}` });
}

async function openPoolTab(user: ReturnType<typeof userEvent.setup>) {
  await renderRouter('./app', { initialUrl: '/' });
  await user.press(await screen.findByRole('button', { name: 'Profil' }));
  await user.press(await screen.findByRole('button', { name: /^Community-Übersicht\./ }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockAuth.setInitialSession(session);
});

describe('progress', () => {
  it('shows the server progress on Home and the runs with reasons in the detail', async () => {
    const user = userEvent.setup();
    const day = 24 * 60 * 60 * 1000;
    const running = challenge({
      status: 'active',
      starts_at: new Date(Date.now() - day).toISOString(),
      ends_at: new Date(Date.now() + 6 * day).toISOString(),
    });
    mockDb.set({
      challenges: [running],
      challenge_participants: [
        participant(running, 'user-2', 'Ben'),
        participant(running, USER_ID, 'Anna Lauf'),
      ],
      activity_workouts: [
        {
          id: 'w1',
          user_id: USER_ID,
          start_at: new Date(Date.now() - 3_600_000).toISOString(),
          distance_m: 3250,
          duration_s: 1200,
          is_valid: true,
          invalid_reason: null,
        },
        {
          id: 'w2',
          user_id: USER_ID,
          start_at: new Date(Date.now() - 7_200_000).toISOString(),
          distance_m: 9000,
          duration_s: 3000,
          is_valid: false,
          invalid_reason: 'manual_entry',
        },
      ],
    });
    mockRpc({ get_my_progress: () => [{ challenge_id: running.id, progress_value: 3250 }] });

    await renderRouter('./app', { initialUrl: '/' });

    expect(
      await screen.findByLabelText('Fortschritt der Challenge: 3,25 von 5,00 km'),
    ).toBeOnTheScreen();
    expect(screen.getByText('von 5,00 km')).toBeOnTheScreen();
    expect(screen.getByText('Noch 5 Tage')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Apple Health ist nicht verbunden. Dein Fortschritt kann so nicht geprüft werden.',
      ),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: '5 km am Stück' }));

    expect(await screen.findByText('DEINE LÄUFE IM ZEITRAUM')).toBeOnTheScreen();
    expect(await screen.findByText('Lauf · 3,25 km · 20 Min.')).toBeOnTheScreen();
    expect(screen.getByText('Lauf · 9,00 km · 50 Min.')).toBeOnTheScreen();
    expect(
      screen.getByText('Manuell eingetragen – manuelle Einträge zählen nie.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('zählt nicht')).toBeOnTheScreen();
  });
});

describe('challenges', () => {
  it('joins an open challenge only after confirming the stake in the sheet', async () => {
    const user = userEvent.setup();
    const open = challenge();
    mockDb.set({
      challenges: [open],
      challenge_participants: [participant(open, 'user-2', 'Ben')],
      wallets: { balance_cents: 10000 },
    });
    mockRpc({
      join_challenge: () => {
        const joined = { ...open, participant_count: 2, pot_cents: 2000 };
        mockDb.set({
          challenges: [joined],
          challenge_participants: [
            participant(joined, 'user-2', 'Ben'),
            participant(joined, USER_ID, 'Anna Lauf'),
          ],
          wallets: { balance_cents: 9000 },
        });
        return {};
      },
    });

    await openChallenge('challenge-1');

    expect(await screen.findByText('Ein Lauf über mindestens 5 km')).toBeOnTheScreen();
    expect(
      screen.getByText(
        '• Manuelle Einträge zählen nicht – nur automatisch aufgezeichnete Daten.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Die Teilnehmerliste siehst du, sobald du dabei bist.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Beitreten' }));
    expect(
      await screen.findByText(
        'Du setzt 10,00 Credits. Erreichst du dein Ziel, bekommst du sie zurück plus deinen Anteil an den Einsätzen der anderen.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Dein Guthaben: 100,00 Credits')).toBeOnTheScreen();
    expect(
      screen.getByText('Testphase: Credits sind virtuell und können nicht ausgezahlt werden.'),
    ).toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('join_challenge', expect.anything());

    await user.press(screen.getByRole('button', { name: 'Jetzt beitreten' }));
    expect(supabaseMock.rpc).toHaveBeenCalledWith('join_challenge', {
      p_challenge_id: 'challenge-1',
      p_stake_cents: 1000,
    });

    expect(await screen.findByRole('button', { name: 'Challenge verlassen' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Anna Lauf (du): offen')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ben: offen')).toBeOnTheScreen();
    expect(screen.getByLabelText('TOPF: 20,00 Credits')).toBeOnTheScreen();
  });

  it('shows the server error when the balance is too low', async () => {
    const user = userEvent.setup();
    mockDb.set({
      challenges: [challenge()],
      challenge_participants: [],
      wallets: { balance_cents: 50 },
    });
    supabaseMock.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_my_profile'
        ? { data: profile, error: null }
        : { data: null, error: { code: 'P0001', message: 'insufficient_funds' } },
    );

    await openChallenge('challenge-1');
    await user.press(await screen.findByRole('button', { name: 'Beitreten' }));
    await user.press(await screen.findByRole('button', { name: 'Jetzt beitreten' }));

    expect(
      await screen.findByText('Dein Guthaben reicht für diesen Einsatz nicht aus.'),
    ).toBeOnTheScreen();
  });

  it('previews a private challenge by code and joins after confirming', async () => {
    const user = userEvent.setup();
    const privateChallenge = challenge({
      id: 'challenge-private',
      title: 'Büro-Lauftreff',
      goal_type: 'run_total',
      target_value: 10000,
      stake_cents: 500,
      visibility: 'private',
      invite_code: 'LAUF26',
    });
    mockDb.set({ challenges: [], challenge_participants: [], wallets: { balance_cents: 10000 } });
    mockRpc({
      get_challenge_by_code: () => privateChallenge,
      join_challenge_by_code: () => {
        mockDb.set({
          challenges: [privateChallenge],
          challenge_participants: [participant(privateChallenge, USER_ID, 'Anna Lauf')],
          wallets: { balance_cents: 9500 },
        });
        return {};
      },
    });

    await openPoolTab(user);
    await user.press(await screen.findByRole('button', { name: 'Code eingeben' }));
    await user.type(await screen.findByLabelText('Einladungscode'), 'lauf26');
    await user.press(screen.getByRole('button', { name: 'Challenge anzeigen' }));

    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_challenge_by_code', { p_code: 'LAUF26' });
    expect(await screen.findByText('Büro-Lauftreff')).toBeOnTheScreen();
    expect(screen.getByText('Insgesamt 10 km laufen')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Beitreten' }));
    await user.press(await screen.findByRole('button', { name: 'Jetzt beitreten' }));

    expect(supabaseMock.rpc).toHaveBeenCalledWith('join_challenge_by_code', {
      p_code: 'LAUF26',
      p_stake_cents: 500,
    });
    expect(await screen.findByText('EINLADUNGSCODE')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Code teilen' })).toBeOnTheScreen();
  });

  it('rejects a malformed invite code without calling the server', async () => {
    const user = userEvent.setup();
    mockDb.set({ challenges: [], challenge_participants: [] });
    mockRpc();

    await openPoolTab(user);
    await user.press(await screen.findByRole('button', { name: 'Code eingeben' }));
    await user.type(await screen.findByLabelText('Einladungscode'), 'AB-1');
    await user.press(screen.getByRole('button', { name: 'Challenge anzeigen' }));

    expect(screen.getByText('Der Code besteht aus 6 Buchstaben und Ziffern.')).toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('get_challenge_by_code', expect.anything());
  });

  it('lists the bookings in the wallet with German labels', async () => {
    const user = userEvent.setup();
    mockDb.set({
      challenges: [],
      challenge_participants: [],
      wallets: { balance_cents: 9000 },
      ledger_entries: [
        {
          id: 'entry-2',
          user_id: USER_ID,
          type: 'stake',
          amount_cents: -1000,
          created_at: '2026-11-12T11:00:00Z',
          challenge: { title: '5 km am Stück' },
        },
        {
          id: 'entry-1',
          user_id: USER_ID,
          type: 'signup_bonus',
          amount_cents: 10000,
          created_at: '2026-11-12T09:00:00Z',
          challenge: null,
        },
      ],
    });
    mockRpc();

    await renderRouter('./app', { initialUrl: '/' });
    await user.press(await screen.findByRole('button', { name: 'Profil' }));
    await user.press(await screen.findByRole('button', { name: /^Wallet\./ }));

    expect(await screen.findByLabelText('Guthaben: 90,00 Credits')).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        screen.getByLabelText(/^Einsatz, 5 km am Stück, −10,00 Credits, 12\.11\.2026/),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByLabelText(/^Startguthaben, \+100,00 Credits/)).toBeOnTheScreen();
  });
});
