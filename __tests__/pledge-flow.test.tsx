import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import { toLocalDate } from '@/lib/dates';

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

const created = {
  id: 'goal-new',
  creator_id: USER_ID,
  title: '3 km laufen · heute',
  goal_type: 'run_total',
  target_value: 3000,
  stake_cents: 600,
  fee_bps: 1000,
  timezone: 'Europe/Berlin',
  starts_at: new Date(Date.now() - 1000).toISOString(),
  ends_at: new Date(Date.now() + DAY).toISOString(),
  sync_grace_hours: 0,
  min_participants: 1,
  max_participants: 1,
  visibility: 'private',
  mode: 'goal',
  invite_code: 'ABC234',
  status: 'active',
  participant_count: 1,
  pot_cents: 600,
  settled_at: null,
  created_at: '2026-11-12T09:00:00Z',
};

function mockRpc() {
  supabaseMock.rpc.mockImplementation(async (fn: string) => {
    if (fn === 'get_my_profile') {
      return { data: profile, error: null };
    }
    if (fn === 'create_goal_with_preferences') {
      return { data: created, error: null };
    }
    if (['get_my_progress', 'get_pool_overview', 'get_my_donations'].includes(fn)) {
      return { data: [], error: null };
    }
    throw new Error(`Unexpected rpc ${fn}`);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockAuth.setInitialSession(createMockSession(USER_ID, 'anna@example.com'));
  mockDb.set({ challenges: [], challenge_participants: [], wallets: { balance_cents: 10000 } });
  mockRpc();
});

describe('pledge in two steps', () => {
  it('shows three suggestions and "Eigenes Ziel" instead of the long form', async () => {
    await renderRouter('./app', { initialUrl: '/' });

    expect(await screen.findByText('Was packst du an?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '3 km heute' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '8.000 Schritte heute' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '10 km diese Woche' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Eigenes Ziel' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Angaben prüfen' })).toBeNull();
  });

  it('sets the pledge only after the button was held, with the chosen amount', async () => {
    const user = userEvent.setup();
    await renderRouter('./app', { initialUrl: '/' });

    await user.press(await screen.findByRole('button', { name: '3 km heute' }));
    expect(await screen.findByRole('button', { name: '5 Pfand setzen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Mehr Pfand' }));
    expect(screen.getByRole('button', { name: '6 Pfand setzen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: '6 Pfand setzen' }));
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      'create_goal_with_preferences',
      expect.anything(),
    );

    await user.longPress(screen.getByRole('button', { name: '6 Pfand setzen' }), {
      duration: 1200,
    });

    const today = toLocalDate(new Date(), 'Europe/Berlin');
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'create_goal_with_preferences',
      expect.objectContaining({
        p_title: '3 km laufen · heute',
        p_goal_type: 'run_total',
        p_target_value: 3000,
        p_stake_cents: 600,
        p_start_date: today,
        p_end_date: today,
      }),
    );
  });

  it('keeps the pledge between 1 and the balance', async () => {
    const user = userEvent.setup();
    mockDb.set({ wallets: { balance_cents: 200 } });
    await renderRouter('./app', { initialUrl: '/' });

    await user.press(await screen.findByRole('button', { name: '8.000 Schritte heute' }));
    await user.press(await screen.findByRole('button', { name: 'Weniger Pfand' }));
    await user.press(screen.getByRole('button', { name: 'Weniger Pfand' }));
    await user.press(screen.getByRole('button', { name: 'Weniger Pfand' }));
    await user.press(screen.getByRole('button', { name: 'Weniger Pfand' }));
    expect(screen.getByRole('button', { name: '1 Pfand setzen' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Weniger Pfand' })).toBeDisabled();
    await user.press(screen.getByRole('button', { name: 'Mehr Pfand' }));
    expect(screen.getByRole('button', { name: '2 Pfand setzen' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mehr Pfand' })).toBeDisabled();
  });
});
