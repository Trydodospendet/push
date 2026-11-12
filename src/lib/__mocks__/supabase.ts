import type { AuthChangeEvent, AuthError, Session } from '@supabase/supabase-js';

/**
 * Manual Jest mock for '@/lib/supabase' (activate with `jest.mock('@/lib/supabase')`).
 * Tests control the session with `mockAuth`, table contents with `mockDb` and stub RPC
 * responses on `supabase.rpc`.
 */
type Listener = (event: AuthChangeEvent, session: Session | null) => void;
type AuthResult = { data: object; error: AuthError | null };
type Row = Record<string, unknown>;

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

/**
 * Tiny in-memory "database" for `supabase.from(table)`. Rows are returned as stored
 * (embedded relations such as `profile` or `challenge` are stored on the row); only `eq`
 * filters are applied, everything else (select, order, limit, gt, gte, lt, lte) is ignored.
 */
let tables: Record<string, Row | Row[]> = {};

export const mockDb = {
  set(next: Record<string, Row | Row[]>) {
    tables = next;
  },
  reset() {
    tables = {};
  },
};

type QueryResult = { data: unknown; error: null };

function createQuery(table: string) {
  const filters: [string, unknown][] = [];

  const rows = (): Row[] | Row | undefined => {
    const stored = tables[table];
    if (!Array.isArray(stored)) {
      return stored;
    }
    return stored.filter((row) => filters.every(([column, value]) => row[column] === value));
  };

  const many = (): QueryResult => {
    const result = rows();
    return { data: result === undefined ? [] : result, error: null };
  };

  const one = (): QueryResult => {
    const result = rows();
    return { data: Array.isArray(result) ? (result[0] ?? null) : (result ?? null), error: null };
  };

  const query = {
    select: () => query,
    order: () => query,
    limit: () => query,
    gt: () => query,
    gte: () => query,
    lt: () => query,
    lte: () => query,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    },
    single: async () => one(),
    maybeSingle: async () => one(),
    then: <T>(resolve: (value: QueryResult) => T) => Promise.resolve(many()).then(resolve),
  };
  return query;
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
  from: jest.fn((table: string) => createQuery(table)),
};
