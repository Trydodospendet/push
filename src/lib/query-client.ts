import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

// React Native has no window focus events: refetch stale data when the app returns to the
// foreground instead.
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => {
    setFocused(state === 'active');
  });
  return () => subscription.remove();
});

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
