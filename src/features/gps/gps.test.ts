import { decodeTrack, encodeTrack } from './codec';
import { formatClock, formatKm, formatPace } from './format';
import {
  haversineM,
  liveSplits,
  measureTrack,
  paceSecondsPerKm,
  JUMP_RESET_STREAK,
  type TrackPoint,
} from './geo';
import {
  buildUploadPayload,
  initialRecorderState,
  MAX_POINTS,
  recorderReducer,
  type RecorderState,
} from './recorder';

const METERS_PER_DEGREE = 111_194.9;

/** A straight track going north, the same shape the pgTAP tests upload. */
function track(
  count: number,
  speed: number,
  options: { accuracy?: number; stepS?: number; segmentFrom?: number; mockAt?: number } = {},
): TrackPoint[] {
  const { accuracy = 5, stepS = 3, segmentFrom = -1, mockAt = -1 } = options;
  return Array.from({ length: count }, (_, i) => ({
    lat: 52.5 + (speed * stepS * i) / METERS_PER_DEGREE,
    lng: 13.4,
    t: 1_700_000_000_000 + i * stepS * 1000,
    accuracy,
    segment: segmentFrom >= 0 && i >= segmentFrom ? 1 : 0,
    mocked: i === mockAt,
    altitude: 100 + i * 0.5,
  }));
}

describe('haversineM', () => {
  it('measures one degree of latitude', () => {
    expect(haversineM(52, 13, 53, 13)).toBeCloseTo(111_195, -1);
  });

  it('is zero for the same place', () => {
    expect(haversineM(52.5, 13.4, 52.5, 13.4)).toBe(0);
  });
});

describe('measureTrack (mirrors public.sync_gps_run)', () => {
  it('measures a clean run', () => {
    const result = measureTrack(track(400, 3));
    expect(result.distanceM).toBeGreaterThan(3585);
    expect(result.distanceM).toBeLessThan(3615);
    expect(result.movingS).toBe(1197);
    expect(result.jumps).toBe(0);
  });

  it('ignores points with poor accuracy', () => {
    expect(measureTrack(track(400, 3, { accuracy: 80 })).usedPoints).toBe(0);
  });

  it('counts a single glitch as a jump and does not measure it', () => {
    const points = track(400, 3);
    points[100] = { ...points[100], lat: points[100].lat + 0.5 };
    const result = measureTrack(points);
    expect(result.jumps).toBe(1);
    expect(result.distanceM).toBeGreaterThan(3570);
    expect(result.distanceM).toBeLessThan(3620);
  });

  it('counts a teleport as repeated jumps, then continues at the new place', () => {
    const points = track(400, 3).map((point, i) =>
      i >= 100 ? { ...point, lat: point.lat + 0.5 } : point,
    );
    const result = measureTrack(points);
    expect(result.jumps).toBe(JUMP_RESET_STREAK);
    expect(result.distanceM).toBeLessThan(3600);
  });

  it('does not measure the way between two segments', () => {
    const result = measureTrack(track(200, 2, { segmentFrom: 100 }));
    expect(result.distanceM).toBeGreaterThan(1180);
    expect(result.distanceM).toBeLessThan(1196);
    expect(result.movingS).toBe(594);
  });

  it('reports mocked points', () => {
    expect(measureTrack(track(100, 3, { mockAt: 10 })).mockedPoints).toBe(1);
  });
});

describe('liveSplits', () => {
  it('gives one split per full kilometre with its time', () => {
    const splits = liveSplits(track(400, 3));
    expect(splits.map((split) => split.km)).toEqual([1, 2, 3]);
    splits.forEach((split) => expect(Math.abs(split.seconds - 333)).toBeLessThanOrEqual(3));
  });

  it('is empty before the first kilometre', () => {
    expect(liveSplits(track(100, 3))).toEqual([]);
  });
});

describe('paceSecondsPerKm', () => {
  it('divides time by distance', () => {
    expect(paceSecondsPerKm(3000, 1000)).toBeCloseTo(333.3, 1);
  });

  it('is unknown before there is a distance', () => {
    expect(paceSecondsPerKm(5, 30)).toBeNull();
    expect(paceSecondsPerKm(1000, 0)).toBeNull();
  });
});

describe('format', () => {
  it.each([
    [0, '0:00'],
    [65, '1:05'],
    [3599, '59:59'],
    [3909, '1:05:09'],
  ])('formats %p seconds as %p', (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });

  it('formats pace and distance', () => {
    expect(formatPace(333.3)).toBe('5:33');
    expect(formatPace(null)).toBe('–:––');
    expect(formatPace(4000)).toBe('–:––');
    expect(formatKm(3591)).toBe('3,59');
  });
});

describe('codec', () => {
  it('round-trips a track', () => {
    const points = track(50, 3, { mockAt: 7, segmentFrom: 25 });
    const decoded = decodeTrack(encodeTrack(points));
    expect(decoded).toHaveLength(50);
    expect(decoded[7].mocked).toBe(true);
    expect(decoded[30].segment).toBe(1);
    expect(decoded[49].t).toBe(points[49].t);
    expect(decoded[49].lat).toBeCloseTo(points[49].lat, 6);
  });

  it('is compact enough for the checkpoint (under 25 characters per point)', () => {
    expect(encodeTrack(track(1000, 3)).length / 1000).toBeLessThan(25);
  });

  it.each(['1,2,3', 'a,b,c,d,e,f;', '1,2,3,4,5,6;', '1,2,3,4,5,6,7,8;'])(
    'returns nothing for damaged input %p',
    (text) => {
      expect(decodeTrack(text)).toEqual([]);
    },
  );

  it('handles an empty track', () => {
    expect(decodeTrack(encodeTrack([]))).toEqual([]);
  });
});

describe('recorderReducer', () => {
  const sample = { lat: 52.5, lng: 13.4, t: 1000, accuracy: 5, mocked: false, altitude: null };

  function run(actions: Parameters<typeof recorderReducer>[1][]): RecorderState {
    return actions.reduce(recorderReducer, initialRecorderState);
  }

  it('collects points only while recording', () => {
    expect(run([{ type: 'points', points: [sample] }]).points).toHaveLength(0);
    const state = run([
      { type: 'start', runId: 'r1' },
      { type: 'points', points: [sample] },
    ]);
    expect(state.status).toBe('recording');
    expect(state.points).toHaveLength(1);
  });

  it('drops points while paused and starts a new segment on resume', () => {
    const state = run([
      { type: 'start', runId: 'r1' },
      { type: 'points', points: [sample] },
      { type: 'pause' },
      { type: 'points', points: [sample] },
      { type: 'resume' },
      { type: 'points', points: [sample] },
    ]);
    expect(state.points.map((point) => point.segment)).toEqual([0, 1]);
  });

  it('finishes only a running or paused run', () => {
    expect(run([{ type: 'stop' }]).status).toBe('idle');
    expect(run([{ type: 'start', runId: 'r1' }, { type: 'stop' }]).status).toBe('finished');
  });

  it('does not start a second run while one is running', () => {
    const state = run([
      { type: 'start', runId: 'r1' },
      { type: 'start', runId: 'r2' },
    ]);
    expect(state.runId).toBe('r1');
  });

  it('restores an interrupted run as paused', () => {
    const restored = run([
      {
        type: 'restore',
        runId: 'r9',
        points: [{ ...sample, segment: 2 }],
      },
    ]);
    expect(restored.status).toBe('paused');
    expect(recorderReducer(restored, { type: 'resume' }).segment).toBe(3);
  });

  it('stops collecting at the upload limit', () => {
    const many = Array.from({ length: MAX_POINTS + 5 }, () => sample);
    const state = run([
      { type: 'start', runId: 'r1' },
      { type: 'points', points: many },
    ]);
    expect(state.points).toHaveLength(MAX_POINTS);
    expect(state.full).toBe(true);
  });

  it('can start again after a finished run', () => {
    const state = run([
      { type: 'start', runId: 'r1' },
      { type: 'stop' },
      { type: 'start', runId: 'r2' },
    ]);
    expect(state.runId).toBe('r2');
    expect(state.points).toHaveLength(0);
  });
});

describe('buildUploadPayload', () => {
  it('uses the array format of public.sync_gps_run', () => {
    const payload = buildUploadPayload('run-1', [
      {
        lat: 52.1234567,
        lng: 13.7654321,
        t: 5,
        accuracy: 4.26,
        segment: 1,
        mocked: true,
        altitude: 101.26,
      },
    ]);
    expect(payload).toEqual({
      client_run_id: 'run-1',
      points: [[52.123457, 13.765432, 5, 4.3, 1, 1, 101.3]],
    });
  });
});
