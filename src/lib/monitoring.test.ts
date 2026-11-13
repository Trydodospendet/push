import { initMonitoring, isMonitoringEnabled, reportError } from './monitoring';

const mockInit = jest.fn();
const mockCapture = jest.fn();
jest.mock('@sentry/react-native', () => ({
  init: (options: unknown) => mockInit(options),
  captureException: (error: unknown) => mockCapture(error),
}));

describe('monitoring', () => {
  it('stays off without a DSN and reports nothing', () => {
    initMonitoring(undefined);
    reportError(new Error('boom'));
    expect(isMonitoringEnabled()).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('starts with privacy-friendly options when a DSN is set', () => {
    initMonitoring('https://key@example.ingest.sentry.io/1');
    expect(isMonitoringEnabled()).toBe(true);
    const options = mockInit.mock.calls[0][0] as {
      sendDefaultPii: boolean;
      maxBreadcrumbs: number;
      beforeSend: (event: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(options.sendDefaultPii).toBe(false);
    expect(options.maxBreadcrumbs).toBe(0);

    const cleaned = options.beforeSend({
      user: { email: 'anna@example.com' },
      request: { url: 'https://x', headers: { a: 'b' } },
      message: 'kept',
    });
    expect(cleaned.user).toBeUndefined();
    expect(cleaned.request).toEqual({});
    expect(cleaned.message).toBe('kept');

    const error = new Error('boom');
    reportError(error);
    expect(mockCapture).toHaveBeenCalledWith(error);
  });
});
