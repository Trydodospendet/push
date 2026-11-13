import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.reset();
  mockDb.reset();
  mockAuth.setInitialSession(createMockSession('user-1', 'anna@example.com'));
  mockDb.set({
    appeals: [
      {
        id: 'ap-1',
        workout_id: 'w-1',
        message: 'Das war ein Wettkampf mit Pacemakern.',
        status: 'accepted',
        resolution_note: 'Bestätigt, danke!',
        created_at: '2026-11-13T10:00:00Z',
        workout: { distance_m: 10000, start_at: '2026-11-12T08:00:00Z' },
      },
    ],
  });
  supabaseMock.rpc.mockImplementation(async (fn: string) =>
    fn === 'get_my_profile' ? { data: profile, error: null } : { data: [], error: null },
  );
});

describe('help', () => {
  it('opens an answer of the FAQ and shows the support contact', async () => {
    const user = userEvent.setup();
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderRouter('./app', { initialUrl: '/help' });

    await user.press(await screen.findByRole('button', { name: 'Was sind Credits?' }));
    expect(screen.getByText(/virtuelle Spielwährung/)).toBeOnTheScreen();

    expect(screen.getByText('kontakt@puschdich.de')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'E-Mail schreiben' }));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('mailto:kontakt@puschdich.de'));
  });

  it('lists the own appeals with their status and the answer', async () => {
    await renderRouter('./app', { initialUrl: '/help' });

    expect(await screen.findByText('Angenommen')).toBeOnTheScreen();
    expect(screen.getByText('Antwort: Bestätigt, danke!')).toBeOnTheScreen();
    expect(screen.getByText('Lauf über 10,00 km')).toBeOnTheScreen();
  });
});
