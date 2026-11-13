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

const profile = {
  id: 'user-1',
  display_name: 'Anna Lauf',
  timezone: 'Europe/Berlin',
  onboarded_at: '2026-11-12T10:00:00Z',
  created_at: '2026-11-12T09:00:00Z',
};

const answers: Record<string, unknown> = {
  get_my_profile: profile,
  get_my_friend_code: 'ABCD2345',
  get_my_friends: [{ user_id: 'u2', display_name: 'Ben Renner' }],
  get_friend_requests: [
    { id: 'f1', display_name: 'Clara Sprint', created_at: '2026-11-13T10:00:00Z' },
  ],
  get_friend_runs: [
    {
      workout_id: 'w1',
      user_id: 'u2',
      display_name: 'Ben Renner',
      is_mine: false,
      distance_m: 7000,
      duration_s: 2400,
      start_at: '2026-11-12T08:00:00Z',
      kudos_count: 0,
      comment_count: 2,
      kudos_by_me: false,
    },
  ],
  get_my_groups: [],
  get_season_board: [],
  send_friend_request: 'pending',
  give_kudos: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockAuth.setInitialSession(createMockSession('user-1', 'anna@example.com'));
  supabaseMock.rpc.mockImplementation(async (fn: string) => ({
    data: fn in answers ? answers[fn] : [],
    error: null,
  }));
});

describe('social', () => {
  it('shows the own friend code, requests, friends and the runs of friends', async () => {
    await renderRouter('./app', { initialUrl: '/social' });

    expect(await screen.findByText('ABCD2345')).toBeOnTheScreen();
    expect(await screen.findByText('Clara Sprint')).toBeOnTheScreen();
    expect(await screen.findByText('Ben Renner · 7,00 km')).toBeOnTheScreen();
    expect(
      screen.getByText('Noch in keiner Gruppe. Erstelle eine oder tritt mit einem Code bei.'),
    ).toBeOnTheScreen();
  });

  it('sends a friend request with a code and gives kudos', async () => {
    const user = userEvent.setup();
    await renderRouter('./app', { initialUrl: '/social' });

    await user.type(await screen.findByLabelText('Code eines Freundes'), 'wxyz9876');
    await user.press(screen.getByRole('button', { name: 'Anfrage senden' }));
    expect(supabaseMock.rpc).toHaveBeenCalledWith('send_friend_request', { p_code: 'WXYZ9876' });
    expect(await screen.findByText(/Anfrage gesendet/)).toBeOnTheScreen();

    await user.press(
      await screen.findByRole('button', { name: 'Kudos für den Lauf von Ben Renner' }),
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith('give_kudos', { p_workout_id: 'w1' });
  });

  it('fills the friend code from a link', async () => {
    await renderRouter('./app', { initialUrl: '/invite/QWER5678' });
    expect(await screen.findByDisplayValue('QWER5678')).toBeOnTheScreen();
  });
});
