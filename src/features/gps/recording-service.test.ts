import * as Location from 'expo-location';

import {
  dispatchRecorder,
  getRecorderState,
  pauseRun,
  requestLocationPermission,
  resumeRun,
  startRun,
  subscribeRecorder,
} from './recording-service';

jest.mock('expo-location');
jest.mock('expo-task-manager');

beforeEach(() => {
  jest.clearAllMocks();
  dispatchRecorder({ type: 'reset' });
});

test('offers a GPS setting hint before requesting permission if location is off', async () => {
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValueOnce(false);

  await expect(requestLocationPermission()).resolves.toBe('servicesDisabled');
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

test('keeps the start screen mounted if starting GPS fails and allows a retry', async () => {
  jest.mocked(Location.startLocationUpdatesAsync).mockRejectedValueOnce(new Error('GPS failed'));
  const onChange = jest.fn();
  const unsubscribe = subscribeRecorder(onChange);
  try {
    await expect(startRun()).rejects.toThrow('GPS failed');
    expect(onChange).not.toHaveBeenCalled();
    expect(getRecorderState().status).toBe('idle');

    await startRun();
    expect(getRecorderState().status).toBe('recording');
  } finally {
    unsubscribe();
  }
});

test('stays paused if GPS cannot resume and starts a new segment on retry', async () => {
  await startRun();
  await pauseRun();
  jest.mocked(Location.startLocationUpdatesAsync).mockRejectedValueOnce(new Error('GPS failed'));
  await expect(resumeRun()).rejects.toThrow('GPS failed');
  expect(getRecorderState()).toMatchObject({ status: 'paused', segment: 0 });

  await resumeRun();
  expect(getRecorderState()).toMatchObject({ status: 'recording', segment: 1 });
});
