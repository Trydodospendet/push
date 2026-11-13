import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components';
import { RouteMap } from '@/features/gps/route-map';
import { readHealthConnectRoute } from '@/features/health/route';
import { de } from '@/i18n/de';
import { colors, spacing } from '@/theme';

const MAP_HEIGHT = 360;

/**
 * The route of a Health Connect run on the map, like a GPS run. Health Connect asks for
 * permission for every single route; the route stays on the phone.
 */
export default function ActivityRouteScreen() {
  const { recordId } = useLocalSearchParams<{ recordId: string; startAt?: string }>();
  const route = useQuery({
    queryKey: ['health-route', recordId] as const,
    enabled: Boolean(recordId),
    retry: false,
    staleTime: Infinity,
    queryFn: () => readHealthConnectRoute(recordId ?? ''),
  });

  return (
    <Screen scroll contentStyle={styles.content}>
      {route.isPending ? (
        <LoadingState />
      ) : route.isError ? (
        <ErrorState message={de.activityTab.routeError} onRetry={() => route.refetch()} />
      ) : route.data.kind === 'route' ? (
        <View style={styles.map}>
          <RouteMap points={route.data.points} mode="fit" height={MAP_HEIGHT} animate />
          <Text variant="caption" color="textMuted">
            {de.activityTab.routeLocal}
          </Text>
        </View>
      ) : (
        <Card style={styles.message}>
          <Text>
            {route.data.kind === 'denied'
              ? de.activityTab.routeDenied
              : route.data.kind === 'unsupported'
                ? de.activityTab.routeUnsupported
                : de.activityTab.routeNone}
          </Text>
          {route.data.kind === 'denied' ? (
            <Button
              label={de.common.retry}
              variant="secondary"
              onPress={() => void route.refetch()}
            />
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.bg,
  },
  map: {
    gap: spacing.sm,
  },
  message: {
    gap: spacing.sm,
  },
});
