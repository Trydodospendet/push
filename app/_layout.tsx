import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Button, ErrorState, LoadingState, Screen } from '@/components';
import { useMyProfile, useSignOut } from '@/features/auth/api';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { de } from '@/i18n/de';
import { createQueryClient } from '@/lib/query-client';
import { colors, fontAssets } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // If the fonts fail to load the app still starts and falls back to the system font.
  const fontsReady = fontsLoaded || fontError !== null;

  if (!fontsReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Decides which part of the app is reachable:
 * signed out → (auth), signed in without display name → onboarding, otherwise → (tabs).
 */
function RootNavigator() {
  const { session, isLoading } = useAuth();
  const profile = useMyProfile(session?.user.id);
  const signOut = useSignOut();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  if (session && profile.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (session && profile.isError) {
    return (
      <Screen>
        <ErrorState
          message={de.session.profileError}
          onRetry={() => profile.refetch()}
          retrying={profile.isFetching}
        />
        <Button
          label={de.session.signOut}
          variant="secondary"
          onPress={() => signOut.mutate()}
          loading={signOut.isPending}
        />
      </Screen>
    );
  }

  const isSignedIn = session !== null;
  const isOnboarded = isSignedIn && profile.data?.onboarded_at != null;
  // Explicit targets: without them a blocked deep link (e.g. "/" while signed out) ends on
  // the "Unmatched Route" screen.
  const home = isOnboarded ? '/' : isSignedIn ? '/onboarding/name' : '/welcome';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!isSignedIn} redirectTo={home}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !isOnboarded} redirectTo={home}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={isOnboarded} redirectTo={home}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenge" />
      </Stack.Protected>
    </Stack>
  );
}
