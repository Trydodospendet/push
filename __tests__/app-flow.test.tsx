import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/lib/supabase');
jest.mock('@/features/health/storage');
jest.mock('@/features/health/native');
// Font loading is not part of this test (and expo-font needs native asset modules).
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));

// The same module instance the app receives (src/lib/__mocks__/supabase.ts).
const {
  createMockSession,
  mockAuth,
  mockDb,
  supabase: supabaseMock,
} = jest.requireMock<typeof import('../src/lib/__mocks__/supabase')>('@/lib/supabase');
const { mockHealthState, saveHealthState } = jest.requireMock<
  typeof import('../src/features/health/__mocks__/storage')
>('@/features/health/storage');
const { mockAdapter } = jest.requireMock<typeof import('../src/features/health/__mocks__/native')>(
  '@/features/health/native',
);

const session = createMockSession('user-1', 'anna@example.com');

function profile(onboarded: boolean, displayName = 'Läufer 1234') {
  return {
    id: 'user-1',
    display_name: displayName,
    timezone: 'Europe/Berlin',
    onboarded_at: onboarded ? '2026-11-12T10:00:00Z' : null,
    created_at: '2026-11-12T09:00:00Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockHealthState.reset();
});

describe('app flow', () => {
  it('signs up a new user: welcome → email → code → name → health → home', async () => {
    const user = userEvent.setup();
    mockHealthState.set({});
    supabaseMock.auth.verifyOtp.mockImplementation(async () => {
      mockAuth.signIn(session);
      return { data: {}, error: null };
    });
    supabaseMock.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_my_profile'
        ? { data: profile(false), error: null }
        : { data: profile(true, 'Anna Lauf'), error: null },
    );

    await renderRouter('./app', { initialUrl: '/' });

    expect(await screen.findByRole('header', { name: 'PUSH' })).toHaveTextContent('PUSH.');
    expect(screen.getByText('YOUR GOALS. YOUR STAKES.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Loslegen' }));

    const emailField = await screen.findByLabelText('E-Mail-Adresse');
    await user.type(emailField, 'keine-mail');
    await user.press(screen.getByRole('button', { name: 'Code senden' }));
    expect(screen.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeOnTheScreen();
    expect(supabaseMock.auth.signInWithOtp).not.toHaveBeenCalled();

    await user.clear(emailField);
    await user.type(emailField, ' Anna@Example.com ');
    await user.press(screen.getByRole('button', { name: 'Code senden' }));
    expect(supabaseMock.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      options: { shouldCreateUser: true },
    });

    expect(
      await screen.findByText('Wir haben einen 6-stelligen Code an anna@example.com geschickt.'),
    ).toBeOnTheScreen();
    await user.type(screen.getByLabelText('6-stelliger Code'), '123456');
    expect(supabaseMock.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      token: '123456',
      type: 'email',
    });

    const nameField = await screen.findByLabelText('Anzeigename');
    await user.type(nameField, 'Al');
    await user.press(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByText('Der Name muss 3 bis 24 Zeichen lang sein.')).toBeOnTheScreen();

    await user.type(nameField, 'ina Lauf');
    await user.press(screen.getByRole('button', { name: 'Weiter' }));
    expect(supabaseMock.rpc).toHaveBeenCalledWith('set_display_name', {
      p_display_name: 'Alina Lauf',
    });

    expect(await screen.findByText('Automatisch geprüft statt behauptet')).toBeOnTheScreen();
    expect(
      screen.getByText(/Manuell eingetragene Läufe und Schritte zählen nicht/),
    ).toBeOnTheScreen();
    expect(mockAdapter.authorize).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Apple Health verbinden' }));
    expect(mockAdapter.authorize).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('Noch keine Challenge')).toBeOnTheScreen();
    expect(saveHealthState).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ introDone: true, connected: true }),
    );
  });

  it('lets the user postpone the health connection and reminds them on Home', async () => {
    const user = userEvent.setup();
    mockHealthState.set({});
    mockAuth.setInitialSession(session);
    supabaseMock.rpc.mockResolvedValue({ data: profile(true, 'Anna Lauf'), error: null });

    await renderRouter('./app', { initialUrl: '/' });

    expect(await screen.findByText('Automatisch geprüft statt behauptet')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Später' }));

    expect(await screen.findByText('Noch keine Challenge')).toBeOnTheScreen();
    expect(mockAdapter.authorize).not.toHaveBeenCalled();
    expect(saveHealthState).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ introDone: true, connected: false }),
    );
  });

  it('continues without a connection when the user denies the system permission', async () => {
    const user = userEvent.setup();
    mockHealthState.set({});
    mockAdapter.authorize.mockResolvedValueOnce(false);
    mockAuth.setInitialSession(session);
    supabaseMock.rpc.mockResolvedValue({ data: profile(true, 'Anna Lauf'), error: null });

    await renderRouter('./app', { initialUrl: '/' });
    await user.press(await screen.findByRole('button', { name: 'Apple Health verbinden' }));

    expect(await screen.findByText('Noch keine Challenge')).toBeOnTheScreen();
    expect(saveHealthState).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ introDone: true, connected: false }),
    );
  });

  it('restores an onboarded session, shows the balance and signs out', async () => {
    const user = userEvent.setup();
    mockAuth.setInitialSession(session);
    supabaseMock.rpc.mockResolvedValue({ data: profile(true, 'Anna Lauf'), error: null });
    mockDb.set({ wallets: { balance_cents: 10000 }, ledger_entries: [] });

    await renderRouter('./app', { initialUrl: '/' });

    expect(await screen.findByText('Noch keine Challenge')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Wallet' }));
    expect(await screen.findByLabelText('Guthaben: 100,00 Credits')).toBeOnTheScreen();
    expect(supabaseMock.from).toHaveBeenCalledWith('wallets');
    expect(
      screen.getByText('Testphase: Credits sind virtuell und können nicht ausgezahlt werden.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Profil' }));
    expect(await screen.findByText('Anna Lauf')).toBeOnTheScreen();
    expect(screen.getByText('anna@example.com')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Abmelden' }));
    expect(await screen.findByRole('button', { name: 'Loslegen' })).toBeOnTheScreen();
  });

  it('sends a signed-in user without display name to onboarding', async () => {
    mockAuth.setInitialSession(session);
    supabaseMock.rpc.mockResolvedValue({ data: profile(false), error: null });

    await renderRouter('./app', { initialUrl: '/' });

    expect(await screen.findByText('Wie sollen wir dich nennen?')).toBeOnTheScreen();
  });

  it('shows a wrong code as an error and stays on the code screen', async () => {
    const user = userEvent.setup();
    const { AuthApiError } =
      jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
    supabaseMock.auth.verifyOtp.mockResolvedValue({
      data: {},
      error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    });

    await renderRouter('./app', { initialUrl: '/verify?email=anna%40example.com' });

    await user.type(await screen.findByLabelText('6-stelliger Code'), '000000');

    await waitFor(() =>
      expect(
        screen.getByText('Der Code ist falsch oder abgelaufen. Fordere bei Bedarf einen neuen an.'),
      ).toBeOnTheScreen(),
    );
  });
});
