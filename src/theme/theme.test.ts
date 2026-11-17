import { colors, layout, radius, spacing, typography } from '@/theme';

// Guards the design tokens against accidental edits (CLAUDE.md, section 9).
describe('theme tokens', () => {
  it('matches the specified color palette', () => {
    expect(colors).toEqual({
      bg: '#0A0A0A',
      surface: '#151515',
      surfaceRaised: '#1F1F1F',
      border: '#222222',
      text: '#FFFFFF',
      textSecondary: '#9A9A9A',
      textMuted: '#8A8A8A',
      accent: '#C6FF00',
      onAccent: '#0A0A0A',
      danger: '#FF4D4D',
      tabInactive: '#6E6E6E',
    });
  });

  it('matches the specified spacing scale and radii', () => {
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 24, 32, 48]);
    expect(radius).toEqual({ card: 16, pill: 999 });
  });

  it('keeps touch targets at 44 pt or more', () => {
    expect(layout.minTouchTarget).toBe(44);
    expect(layout.buttonHeight).toBeGreaterThanOrEqual(layout.minTouchTarget);
  });

  it('renders key figures between 56 and 72 pt with tabular numbers', () => {
    expect(typography.display.fontSize).toBeGreaterThanOrEqual(56);
    expect(typography.display.fontSize).toBeLessThanOrEqual(72);
    expect(typography.display.fontVariant).toContain('tabular-nums');
  });
});
