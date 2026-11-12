import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { toUserMessage } from './errors';

describe('toUserMessage', () => {
  it('explains a wrong or expired code', () => {
    expect(toUserMessage(new AuthApiError('Token has expired', 403, 'otp_expired'))).toBe(
      'Der Code ist falsch oder abgelaufen. Fordere bei Bedarf einen neuen an.',
    );
  });

  it('explains rate limits', () => {
    expect(toUserMessage(new AuthApiError('Too many', 429, 'over_email_send_rate_limit'))).toMatch(
      /Zu viele Versuche/,
    );
    expect(toUserMessage(new AuthApiError('Too many', 429, undefined))).toMatch(
      /Zu viele Versuche/,
    );
  });

  it('explains network problems', () => {
    expect(toUserMessage(new AuthRetryableFetchError('Failed to fetch', 0))).toMatch(
      /Keine Verbindung/,
    );
    expect(toUserMessage(new TypeError('Network request failed'))).toMatch(/Keine Verbindung/);
  });

  it('maps errors raised by our database functions', () => {
    expect(toUserMessage({ code: 'P0001', message: 'invalid_display_name' })).toBe(
      'Der Name muss 3 bis 24 Zeichen lang sein.',
    );
  });

  it('falls back to a generic message', () => {
    expect(toUserMessage(new AuthApiError('Boom', 500, 'unexpected_failure'))).toBe(
      'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    );
    expect(toUserMessage(null)).toBe('Etwas ist schiefgelaufen. Bitte versuche es erneut.');
  });
});
