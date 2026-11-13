import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.mock('@/lib/supabase');
jest.mock('@/features/health/storage');
jest.mock('@/features/intro/storage');
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
const { mockHealthState, saveHealthState, clearHealthState } = jest.requireMock<
  typeof import('../src/features/health/__mocks__/storage')
>('@/features/health/storage');
const { mockIntro, saveIntroSeen } = jest.requireMock<
  typeof import('../src/features/intro/__mocks__/storage')
>('@/features/intro/storage');
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
  mockIntro.reset();
});

describe('app flow', () => {
  it('shows the intro pages once, then continues to the app', async () => {
    const user = userEvent.setup();
    mockIntro.set(false);
    mockAuth.setInitialSession(session);
    supabaseMock.rpc.mockResolvedValue({ data: profile(true, 'Anna Lauf'), error: null });

    await renderRouter('./app', { initialUrl: '/' });

    expect(await screen.findByText("So funktioniert's")).toBeOnTheScreen();
    expect(screen.getByText('Automatisch geprüft über Apple Health')).toBeOnTheScreen();
    expect(screen.getByText('So wird ausgezahlt')).toBeOnTheScreen();
    for (let page = 0; page < 4; page += 1) {
      await user.press(screen.getByRole('button', { name: 'Weiter' }));
    }
    await user.press(screen.getByRole('button', { name: "Los geht's" }));

    expect(await screen.findByText('Noch keine Challenge')).toBeOnTheScreen();
    expect(saveIntroSeen).toHaveBeenCalledWith('user-1');
  });

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

  it('deletes the account only after confirmation and returns to the welcome screen', async () => {
    const user = userEvent.setup();
    mockAuth.setInitialSession(session);
    supabaseMock.rpc.mockImplementation(async (fn: string) =>
      fn === 'delete_my_account'
        ? { data: null, error: null }
        : { data: profile(true, 'Anna Lauf'), error: null },
    );

    await renderRouter('./app', { initialUrl: '/settings/data' });

    await user.press(await screen.findByRole('button', { name: 'Konto löschen' }));
    expect(screen.getByText('Konto endgültig löschen?')).toBeOnTheScreen();
    expect(
      screen.getByText(/In Challenges, die schon laufen, verfällt dein Einsatz/),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('delete_my_account');

    await user.press(screen.getByRole('button', { name: 'Konto löschen' }));
    await user.press(await screen.findByRole('button', { name: 'Endgültig löschen' }));

    expect(await screen.findByRole('button', { name: 'Loslegen' })).toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(clearHealthState).toHaveBeenCalledWith('user-1');
    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the user signed in when the deletion fails', async () => {
    const user = userEvent.setup();
    mockAuth.setInitialSession(session);
    supabaseMock.rpc.mockImplementation(async (fn: string) =>
      fn === 'delete_my_account'
        ? { data: null, error: { message: 'Network request failed' } }
        : { data: profile(true, 'Anna Lauf'), error: null },
    );

    await renderRouter('./app', { initialUrl: '/settings/data' });

    await user.press(await screen.findByRole('button', { name: 'Konto löschen' }));
    await user.press(screen.getByRole('button', { name: 'Endgültig löschen' }));

    expect(
      await screen.findByText('Löschen hat nicht geklappt. Prüfe deine Internetverbindung.'),
    ).toBeOnTheScreen();
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
    expect(clearHealthState).not.toHaveBeenCalled();
  });

  it('opens privacy policy and imprint from the profile', async () => {
    const user = userEvent.setup();
    mockAuth.setInitialSession(session);
    supabaseMock.rpc.mockResolvedValue({ data: profile(true, 'Anna Lauf'), error: null });

    await renderRouter('./app', { initialUrl: '/settings/data' });

    await user.press(await screen.findByRole('button', { name: 'Datenschutz' }));
    expect(
      await screen.findByRole('header', { name: '5. Health Connect und Apple Health' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Limited Use/)).toBeOnTheScreen();
  });

  it('signs in with a password as an alternative to the code', async () => {
    const user = userEvent.setup();
    await renderRouter('./app', { initialUrl: '/sign-in' });

    await user.press(await screen.findByRole('radio', { name: 'Passwort' }));
    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'anna@example.com');
    await user.press(screen.getByRole('button', { name: 'Anmelden' }));
    expect(screen.getByText('Bitte gib dein Passwort ein.')).toBeOnTheScreen();
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Dein Passwort'), 'geheim123');
    await user.press(screen.getByRole('button', { name: 'Anmelden' }));
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'anna@example.com',
      password: 'geheim123',
    });
  });

  it('sends a code when the password was forgotten', async () => {
    const user = userEvent.setup();
    await renderRouter('./app', { initialUrl: '/sign-in' });

    await user.press(await screen.findByRole('radio', { name: 'Passwort' }));
    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'anna@example.com');
    await user.press(screen.getByRole('button', { name: 'Passwort vergessen – Code senden' }));

    expect(supabaseMock.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'anna@example.com',
      options: { shouldCreateUser: true },
    });
    expect(await screen.findByText(/Nach der Anmeldung kannst du unter Profil/)).toBeOnTheScreen();
  });

  it('shows the legal pages without an account', async () => {
    await renderRouter('./app', { initialUrl: '/legal/imprint' });

    expect(await screen.findByRole('header', { name: 'Angaben gemäß § 5 DDG' })).toBeOnTheScreen();
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
