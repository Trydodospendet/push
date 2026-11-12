import {
  aggregateRecord,
  getGrantedPermissions,
  initialize,
  readRecords,
} from 'react-native-health-connect';

import { adapter } from './healthconnect';

jest.mock('react-native-health-connect', () => ({
  aggregateRecord: jest.fn(),
  getGrantedPermissions: jest.fn(),
  getSdkStatus: jest.fn(),
  initialize: jest.fn(),
  readRecords: jest.fn(),
  requestPermission: jest.fn(),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
  ExerciseType: { RUNNING: 56, RUNNING_TREADMILL: 57 },
}));

const MANUAL = 3;
const AUTOMATIC = 2;
const now = new Date('2026-11-14T10:30:00Z');
const firstAuthorizedAt = new Date('2026-11-14T09:00:00Z');

const read = jest.mocked(readRecords) as jest.Mock;
const aggregate = jest.mocked(aggregateRecord) as jest.Mock;

function session(id: string, origin: string, recordingMethod: number, exerciseType = 56) {
  return {
    exerciseType,
    startTime: '2026-11-13T10:00:00.000Z',
    endTime: '2026-11-13T10:30:00.000Z',
    metadata: { id, dataOrigin: origin, recordingMethod },
  };
}

function mockHealthConnect(records: {
  sessions?: ReturnType<typeof session>[];
  distances?: { metadata: { dataOrigin: string; recordingMethod: number } }[];
  steps: { metadata: { dataOrigin?: string; recordingMethod: number } }[];
}) {
  read.mockImplementation(async (type: string) => ({
    records:
      type === 'ExerciseSession'
        ? (records.sessions ?? [])
        : type === 'Distance'
          ? (records.distances ?? [])
          : records.steps,
    pageToken: undefined,
  }));
  aggregate.mockImplementation(async ({ recordType }: { recordType: string }) =>
    recordType === 'Distance' ? { DISTANCE: { inMeters: 5012.4 } } : { COUNT_TOTAL: 8000 },
  );
}

const permissionsGranted = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'Steps' },
];

describe('Health Connect adapter', () => {
  beforeEach(() => {
    read.mockReset();
    aggregate.mockReset();
    jest.mocked(initialize).mockResolvedValue(true);
    jest.mocked(getGrantedPermissions).mockResolvedValue(permissionsGranted as never);
  });

  it('reports a manual run as user entered with no distance, a normal run with its distance', async () => {
    mockHealthConnect({
      sessions: [
        session('auto-run', 'app.watch', AUTOMATIC),
        session('manual-run', 'app.manual', MANUAL),
        session('walk', 'app.watch', AUTOMATIC, 79),
      ],
      distances: [{ metadata: { dataOrigin: 'app.watch', recordingMethod: AUTOMATIC } }],
      steps: [],
    });

    const { workouts } = await adapter.read('Europe/Berlin', now, firstAuthorizedAt);

    expect(workouts.map((w) => w.source_record_id)).toEqual(['auto-run', 'manual-run']);
    expect(workouts[0]).toMatchObject({
      distance_m: 5012,
      duration_s: 1800,
      was_user_entered: false,
      platform: 'android',
    });
    expect(workouts[1]).toMatchObject({ distance_m: 0, was_user_entered: true });
  });

  it('treats a run as manual when its distance was entered by hand', async () => {
    mockHealthConnect({
      sessions: [session('mixed', 'app.watch', AUTOMATIC)],
      distances: [{ metadata: { dataOrigin: 'app.watch', recordingMethod: MANUAL } }],
      steps: [],
    });

    const { workouts } = await adapter.read('Europe/Berlin', now, firstAuthorizedAt);

    expect(workouts[0]).toMatchObject({ was_user_entered: true, distance_m: 0 });
  });

  it('aggregates steps once per day over the sources without manual entries', async () => {
    mockHealthConnect({
      steps: [
        { metadata: { dataOrigin: 'app.watch', recordingMethod: AUTOMATIC } },
        { metadata: { dataOrigin: 'app.phone', recordingMethod: AUTOMATIC } },
        { metadata: { dataOrigin: 'app.manual', recordingMethod: MANUAL } },
      ],
    });

    const { days } = await adapter.read('Europe/Berlin', now, firstAuthorizedAt);

    const stepCalls = aggregate.mock.calls.filter(([query]) => query.recordType === 'Steps');
    expect(stepCalls.length).toBe(days.length);
    for (const [query] of stepCalls) {
      expect([...query.dataOriginFilter].sort()).toEqual(['app.phone', 'app.watch']);
    }
    expect(days[0]).toMatchObject({ steps: 8000, excluded_sources: 1, platform: 'android' });
  });

  it('reports zero steps and never asks for "all sources" when every source is manual', async () => {
    mockHealthConnect({
      steps: [{ metadata: { dataOrigin: 'app.manual', recordingMethod: MANUAL } }],
    });

    const { days } = await adapter.read('Europe/Berlin', now, firstAuthorizedAt);

    expect(aggregate.mock.calls.filter(([query]) => query.recordType === 'Steps')).toHaveLength(0);
    expect(days.every((day) => day.steps === 0 && day.excluded_sources === 1)).toBe(true);
  });

  it('only reads days Health Connect lets the app see (30 days before the first permission)', async () => {
    mockHealthConnect({ steps: [] });

    const { days } = await adapter.read('Europe/Berlin', now, firstAuthorizedAt);

    expect(days.length).toBeLessThanOrEqual(31);
    expect(days[days.length - 1].date).toBe('2026-11-14');
  });

  it('stops instead of guessing when a record has no source', async () => {
    mockHealthConnect({ steps: [{ metadata: { recordingMethod: AUTOMATIC } }] });

    await expect(adapter.read('Europe/Berlin', now, firstAuthorizedAt)).rejects.toThrow(
      'health_missing_origin',
    );
  });

  it('refuses to read without all three permissions', async () => {
    jest.mocked(getGrantedPermissions).mockResolvedValue(permissionsGranted.slice(0, 2) as never);

    await expect(adapter.read('Europe/Berlin', now, firstAuthorizedAt)).rejects.toThrow(
      'health_permission',
    );
  });
});
