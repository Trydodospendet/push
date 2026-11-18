import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
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

const profile = {
  id: USER_ID,
  display_name: 'Anna Lauf',
  timezone: 'Europe/Berlin',
  onboarded_at: '2026-11-12T10:00:00Z',
  created_at: '2026-11-12T09:00:00Z',
};

function mockRpc(realMoney: boolean) {
  supabaseMock.rpc.mockImplementation(async (fn: string) => {
    if (fn === 'get_my_profile') {
      return { data: profile, error: null };
    }
    if (fn === 'get_real_money_status') {
      return { data: realMoney, error: null };
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
  mockDb.set({
    challenges: [],
    challenge_participants: [],
    wallets: { balance_cents: 10000 },
    ngos: [{ id: 'ngo-1', name: 'Ärzte ohne Grenzen' }],
    payments: [
      {
        id: 'pay-1',
        amount_cents: 500,
        status: 'reserved',
        challenge_id: 'goal-new',
        payment_intent_id: 'pi_1',
        created_at: '2026-11-17T10:00:00Z',
      },
    ],
  });
  supabaseMock.functions.invoke.mockResolvedValue({
    data: {
      clientSecret: 'pi_1_secret',
      customerId: 'cus_1',
      ephemeralKey: 'ek_1',
      paymentIntentId: 'pi_1',
    },
    error: null,
  });
});

describe('real-money pledge', () => {
  it('reserves on the card instead of booking credits when the server switch is on', async () => {
    const user = userEvent.setup();
    mockRpc(true);
    await renderRouter('./app', { initialUrl: '/' });

    await user.press(await screen.findByRole('radio', { name: '3 km heute' }));
    await user.press(screen.getByRole('button', { name: 'Ziel setzen' }));
    expect(
      await screen.findByText(
        '5 € werden reserviert, nicht abgebucht. Schaffst du dein Ziel, wird nichts abgebucht. Verfehlst du es, wird dein Pfand fällig; 90 % davon spenden wir an Ärzte ohne Grenzen.',
      ),
    ).toBeOnTheScreen();

    await user.longPress(screen.getByRole('button', { name: '5 Pfand setzen' }), {
      duration: 1200,
    });

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      'create-pledge-intent',
      expect.objectContaining({ body: expect.objectContaining({ stake_cents: 500 }) }),
    );
    expect(initPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentClientSecret: 'pi_1_secret' }),
    );
    expect(presentPaymentSheet).toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      'create_goal_with_preferences',
      expect.anything(),
    );
  });

  it('keeps everything with credits when the switch is off', async () => {
    const user = userEvent.setup();
    mockRpc(false);
    await renderRouter('./app', { initialUrl: '/' });

    await user.press(await screen.findByRole('radio', { name: '3 km heute' }));
    await user.press(screen.getByRole('button', { name: 'Ziel setzen' }));
    expect(await screen.findByRole('button', { name: '5 Pfand setzen' })).toBeOnTheScreen();
    expect(screen.queryByText(/werden reserviert, nicht abgebucht/)).toBeNull();
    expect(supabaseMock.functions.invoke).not.toHaveBeenCalled();
  });
});
