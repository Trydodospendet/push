import { useSession } from '@/features/auth/auth-provider';
import { useMyGpsRuns, useGpsRunRoute } from './api';
import { RouteMap } from './route-map';

/** Latest recorded route; all older routes remain individually accessible below. */
export function HistoryMap() {
  const session = useSession();
  const runs = useMyGpsRuns(session.user.id);
  const latest = runs.data?.find((run) => run.hasRoute);
  const route = useGpsRunRoute(latest?.id ?? '', latest !== undefined);
  return <RouteMap points={route.data ?? []} mode="fit" height={240} animate />;
}
