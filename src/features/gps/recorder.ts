import { measureTrack, type Measurement, type TrackPoint } from './geo';

/** Upload limit of the server (public.sync_gps_run). */
export const MAX_POINTS = 20_000;

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'finished';

export type RecorderState = {
  status: RecorderStatus;
  /** Chosen when the run starts; makes the upload idempotent. */
  runId: string | null;
  points: readonly TrackPoint[];
  /** Segment number for new points; grows with every pause. */
  segment: number;
  /** True once the point limit was reached; further points are dropped. */
  full: boolean;
};

export const initialRecorderState: RecorderState = {
  status: 'idle',
  runId: null,
  points: [],
  segment: 0,
  full: false,
};

export type RecorderAction =
  | { type: 'start'; runId: string }
  | { type: 'points'; points: readonly Omit<TrackPoint, 'segment'>[] }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'restore'; runId: string; points: readonly TrackPoint[] }
  | { type: 'reset' };

export function recorderReducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case 'start':
      return state.status === 'idle' || state.status === 'finished'
        ? { ...initialRecorderState, status: 'recording', runId: action.runId }
        : state;
    case 'points': {
      if (state.status !== 'recording') {
        return state;
      }
      const room = MAX_POINTS - state.points.length;
      const accepted = action.points
        .slice(0, Math.max(0, room))
        .map((point) => ({ ...point, segment: state.segment }));
      return {
        ...state,
        points: [...state.points, ...accepted],
        full: state.full || action.points.length > room,
      };
    }
    case 'pause':
      return state.status === 'recording' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return state.status === 'paused'
        ? { ...state, status: 'recording', segment: state.segment + 1 }
        : state;
    case 'stop':
      return state.status === 'recording' || state.status === 'paused'
        ? { ...state, status: 'finished' }
        : state;
    case 'restore': {
      const lastSegment = action.points.reduce((max, point) => Math.max(max, point.segment), 0);
      // An interrupted run continues as a new segment: the way back is not measured.
      return {
        status: 'paused',
        runId: action.runId,
        points: action.points,
        segment: lastSegment,
        full: action.points.length >= MAX_POINTS,
      };
    }
    case 'reset':
      return initialRecorderState;
  }
}

export type LiveStats = Measurement & {
  /** Seconds between the first and the last counted point (no pauses). */
  elapsedS: number;
};

/** Numbers for the display while recording. */
export function liveStats(points: readonly TrackPoint[]): LiveStats {
  const measurement = measureTrack(points);
  return { ...measurement, elapsedS: measurement.movingS };
}

/** The payload for public.sync_gps_run. Coordinates are rounded to about 10 cm. */
export function buildUploadPayload(
  runId: string,
  points: readonly TrackPoint[],
): { client_run_id: string; points: number[][] } {
  return {
    client_run_id: runId,
    points: points.map((point) => [
      Math.round(point.lat * 1e6) / 1e6,
      Math.round(point.lng * 1e6) / 1e6,
      point.t,
      Math.round(point.accuracy * 10) / 10,
      point.segment,
      point.mocked ? 1 : 0,
    ]),
  };
}
