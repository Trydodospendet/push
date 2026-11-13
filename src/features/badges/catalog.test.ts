import { de } from '@/i18n/de';

import { BADGE_CODES, BADGE_ICONS } from './catalog';

describe('badge catalog', () => {
  it.each(BADGE_CODES)('has a title, a description and an icon for %s', (code) => {
    expect(de.badges.items[code].title.length).toBeGreaterThan(0);
    expect(de.badges.items[code].description.length).toBeGreaterThan(0);
    expect(BADGE_ICONS[code]).toBeTruthy();
  });
});
