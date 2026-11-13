import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Button, ErrorBoundary, ErrorState, LoadingState, Screen } from '@/components';
import { useMyProfile, useSignOut } from '@/features/auth/api';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { DEFAULT_TIMEZONE } from '@/config/app';
import { HealthProvider, useHealth } from '@/features/health/health-provider';
import { IntroProvider, useIntro } from '@/features/intro/intro-provider';
import { GpsProvider } from '@/features/gps/gps-provider';
import { ReminderProvider } from '@/features/reminders/reminder-provider';
import { de } from '@/i18n/de';
import { loadPreferences } from '@/features/preferences/store';
import { noteFirstUse } from '@/features/review/review';
import { targetOfNotification } from '@/features/push/api';
import { initMonitoring, reportError } from '@/lib/monitoring';
import { createQueryClient } from '@/lib/query-client';
import { colors, fontAssets } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // If the fonts fail to load the app still starts and falls back to the system font.
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    void loadPreferences();
    initMonitoring();
    void noteFirstUse();
    // A tap on a notification opens the challenge it is about (only app-internal links).
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = targetOfNotification(response.notification.request.content.data);
      if (target) {
        router.push({ pathname: '/challenge/[id]', params: { id: target.split('/')[2] } });
      }
    });
    return () => subscription.remove();
  }, []);

  if (!fontsReady) {
    return null;
  }

  return (
    <ErrorBoundary onError={reportError}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
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

  return (
    <HealthProvider
      userId={session?.user.id ?? null}
      timezone={profile.data?.timezone ?? DEFAULT_TIMEZONE}
    >
      <IntroProvider userId={session?.user.id ?? null}>
        <ReminderProvider userId={session?.user.id ?? null}>
          <GpsProvider userId={session?.user.id ?? null}>
            <AppStack isSignedIn={isSignedIn} isOnboarded={isOnboarded} />
          </GpsProvider>
        </ReminderProvider>
      </IntroProvider>
    </HealthProvider>
  );
}

/**
 * After the login the three intro pages come first (once per account and phone, also for
 * existing users), then the name, then the health explanation (once per account and phone).
 */
function AppStack({ isSignedIn, isOnboarded }: { isSignedIn: boolean; isOnboarded: boolean }) {
  const health = useHealth();
  const intro = useIntro();

  if (!health.ready || !intro.ready) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  const isSetUp = isOnboarded && health.introDone && intro.seen;
  // Explicit targets: without them a blocked deep link (e.g. "/" while signed out) ends on
  // the "Unmatched Route" screen.
  const home = isSetUp
    ? '/'
    : !isSignedIn
      ? '/welcome'
      : !intro.seen
        ? '/onboarding/intro'
        : isOnboarded
          ? '/onboarding/health'
          : '/onboarding/name';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!isSignedIn} redirectTo={home}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !isSetUp} redirectTo={home}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={isSetUp} redirectTo={home}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="wallet"
          options={{
            headerShown: true,
            title: de.tabs.wallet,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen
          name="pool"
          options={{
            headerShown: true,
            title: de.improvements.pool,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen name="challenge" />
        <Stack.Screen name="how-it-works" />
        <Stack.Screen name="run" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="social"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
        <Stack.Screen name="invite/[code]" />
        <Stack.Screen name="join/[code]" />
        <Stack.Screen
          name="battery"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
        <Stack.Screen
          name="help"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </Stack.Protected>
      <Stack.Screen name="legal" />
    </Stack>
  );
}
