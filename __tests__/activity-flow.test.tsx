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
const { mockHealthState } = jest.requireMock<
  typeof import('../src/features/health/__mocks__/storage')
>('@/features/health/storage');
const { mockAdapter } = jest.requireMock<typeof import('../src/features/health/__mocks__/native')>(
  '@/features/health/native',
);

const USER_ID = 'user-1';

const profile = {
  id: USER_ID,
  display_name: 'Anna Lauf',
  timezone: 'Europe/Berlin',
  onboarded_at: '2026-11-12T10:00:00Z',
  created_at: '2026-11-12T09:00:00Z',
};

function mockRpc() {
  supabaseMock.rpc.mockImplementation(async (fn: string) => {
    if (fn === 'get_my_profile') {
      return { data: profile, error: null };
    }
    return { data: [], error: null };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockHealthState.reset();
  mockAuth.setInitialSession(createMockSession(USER_ID, 'anna@example.com'));
  mockRpc();
});

describe('activity tab', () => {
  it('opens from the tab bar and explains the empty state', async () => {
    const user = userEvent.setup();
    mockDb.set({ activity_workouts: [], activity_daily_steps: [], gps_runs: [] });

    await renderRouter('./app', { initialUrl: '/' });
    await user.press(await screen.findByRole('button', { name: 'Aktivität' }));

    expect(await screen.findByRole('header', { name: 'Aktivität' })).toBeOnTheScreen();
    expect(await screen.findByText('Noch keine Aktivitäten')).toBeOnTheScreen();
    // Not connected: a clear hint with the way to connect, and the GPS option stays available.
    expect(
      screen.getByText(
        'Apple Health ist nicht verbunden. Dein Fortschritt kann so nicht geprüft werden.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Apple Health verbinden' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lauf aufzeichnen' })).toBeOnTheScreen();
  });

  it('lists taken-over runs and steps and shows why a run does not count', async () => {
    mockHealthState.set({
      introDone: true,
      connected: true,
      firstAuthorizedAt: '2026-11-01T10:00:00Z',
      lastSyncAt: new Date().toISOString(),
    });
    mockDb.set({
      activity_workouts: [
        {
          id: 'w1',
          user_id: USER_ID,
          start_at: new Date(Date.now() - 3_600_000).toISOString(),
          distance_m: 5200,
          duration_s: 1800,
          is_valid: true,
          invalid_reason: null,
          source_record_id: 'hc-1',
          platform: 'ios',
        },
        {
          id: 'w2',
          user_id: USER_ID,
          start_at: new Date(Date.now() - 7_200_000).toISOString(),
          distance_m: 9000,
          duration_s: 3000,
          is_valid: false,
          invalid_reason: 'manual_entry',
          source_record_id: 'hc-2',
          platform: 'ios',
        },
      ],
      activity_daily_steps: [{ user_id: USER_ID, date: '2026-11-12', steps: 8123, is_valid: true }],
      gps_runs: [],
    });

    await renderRouter('./app', { initialUrl: '/activity' });

    expect(await screen.findByText('Lauf · 5,20 km · 30 Min.')).toBeOnTheScreen();
    expect(screen.getByText('Lauf · 9,00 km · 50 Min.')).toBeOnTheScreen();
    expect(
      screen.getByText('Manuell eingetragen – manuelle Einträge zählen nie.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('8.123 Schritte')).toBeOnTheScreen();
    expect(screen.queryByText('Noch keine Aktivitäten')).toBeNull();
  });

  it('shows a failed synchronisation with a retry button', async () => {
    const user = userEvent.setup();
    mockHealthState.set({
      introDone: true,
      connected: true,
      firstAuthorizedAt: '2026-11-01T10:00:00Z',
      lastSyncAt: null,
    });
    mockAdapter.read.mockRejectedValueOnce(new Error('network'));
    mockDb.set({ activity_workouts: [], activity_daily_steps: [], gps_runs: [] });

    await renderRouter('./app', { initialUrl: '/activity' });

    const retry = await screen.findByRole('button', { name: 'Erneut versuchen' });
    await user.press(retry);
    expect(mockAdapter.read).toHaveBeenCalledTimes(2);
  });
});
