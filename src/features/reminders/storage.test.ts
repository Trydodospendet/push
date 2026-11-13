import { secureStorage } from '@/lib/secure-storage';

import { defaultReminderSettings } from './plan';
import { loadReminderSettings, saveReminderSettings } from './storage';

jest.mock('@/lib/secure-storage');

const store = jest.mocked(secureStorage);

describe('reminder settings storage', () => {
  beforeEach(() => {
    store.getItem.mockReset();
    store.setItem.mockReset();
  });

  it('starts switched off', async () => {
    store.getItem.mockResolvedValue(null);
    const settings = await loadReminderSettings('user-1');
    expect(settings).toEqual(defaultReminderSettings);
    expect(settings.enabled).toBe(false);
  });

  it('keeps one setting per account', async () => {
    const settings = { enabled: true, hour: 7, minute: 30 };
    await saveReminderSettings('user-1', settings);
    expect(store.setItem).toHaveBeenCalledWith('push.reminders.user-1', JSON.stringify(settings));
    store.getItem.mockResolvedValue(JSON.stringify(settings));
    await expect(loadReminderSettings('user-1')).resolves.toEqual(settings);
  });

  it.each(['nope', '{"enabled":true,"hour":25,"minute":0}', '[]'])(
    'ignores damaged value %p',
    async (raw) => {
      store.getItem.mockResolvedValue(raw);
      await expect(loadReminderSettings('user-1')).resolves.toEqual(defaultReminderSettings);
    },
  );
});
