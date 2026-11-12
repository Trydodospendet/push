import type { AuthChangeEvent, AuthError, Session } from '@supabase/supabase-js';

type AuthResult = { data: object; error: AuthError | null };

/**
 * Manual Jest mock for '@/lib/supabase' (activate with `jest.mock('@/lib/supabase')`).
 * Tests control the session with `mockAuth` and stub responses on `supabase.rpc` / `from`.
 */
type Listener = (event: AuthChangeEvent, session: Session | null) => void;

let currentSession: Session | null = null;
const listeners = new Set<Listener>();

export function createMockSession(userId = 'user-1', email = 'anna@example.com'): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  };
}

export const mockAuth = {
  /** Session that INITIAL_SESSION reports when the app starts. */
  setInitialSession(session: Session | null) {
    currentSession = session;
  },
  signIn(session: Session) {
    currentSession = session;
    listeners.forEach((listener) => listener('SIGNED_IN', session));
  },
  reset() {
    currentSession = null;
    listeners.clear();
  },
};

/** Query builder stub for `supabase.from(table).select().eq().single()`. */
type SingleRowBuilder<T> = {
  select: jest.Mock<SingleRowBuilder<T>>;
  eq: jest.Mock<SingleRowBuilder<T>>;
  single: jest.Mock<Promise<{ data: T; error: null }>>;
};

export function mockSingleRow<T>(data: T): SingleRowBuilder<T> {
  const builder: SingleRowBuilder<T> = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn(async () => ({ data, error: null })),
  };
  return builder;
}

export const supabase = {
  auth: {
    onAuthStateChange: jest.fn((listener: Listener) => {
      listeners.add(listener);
      listener('INITIAL_SESSION', currentSession);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    }),
    signInWithOtp: jest.fn(async (): Promise<AuthResult> => ({ data: {}, error: null })),
    verifyOtp: jest.fn(async (): Promise<AuthResult> => ({ data: {}, error: null })),
    signOut: jest.fn(async () => {
      currentSession = null;
      listeners.forEach((listener) => listener('SIGNED_OUT', null));
      return { error: null };
    }),
  },
  rpc: jest.fn(),
  from: jest.fn(),
};
