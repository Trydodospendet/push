import { initials } from './initials';

describe('initials', () => {
  it('uses the first letters of the first and last word', () => {
    expect(initials('Anna Lauf')).toBe('AL');
    expect(initials('  anna maria lauf ')).toBe('AL');
  });

  it('uses the first two letters of a single word', () => {
    expect(initials('Läufer')).toBe('LÄ');
    expect(initials('x')).toBe('X');
  });

  it('falls back to a question mark', () => {
    expect(initials('   ')).toBe('?');
  });
});
