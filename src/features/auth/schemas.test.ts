import { displayNameSchema, emailSchema, signInCodeSchema, validate } from './schemas';

describe('emailSchema', () => {
  it('trims and lower-cases valid addresses', () => {
    expect(validate(emailSchema, '  Anna@Example.COM ')).toEqual({
      ok: true,
      value: 'anna@example.com',
    });
  });

  it.each(['', 'anna', 'anna@', '@example.com', 'anna example@x.de'])('rejects %p', (input) => {
    expect(validate(emailSchema, input)).toEqual({
      ok: false,
      message: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    });
  });
});

describe('signInCodeSchema', () => {
  it('accepts exactly six digits', () => {
    expect(validate(signInCodeSchema, ' 012345 ')).toEqual({ ok: true, value: '012345' });
  });

  it.each(['12345', '1234567', '12a456', ''])('rejects %p', (input) => {
    expect(validate(signInCodeSchema, input).ok).toBe(false);
  });
});

describe('displayNameSchema (same limits as the database)', () => {
  it('trims the name', () => {
    expect(validate(displayNameSchema, '  Anna Lauf  ')).toEqual({ ok: true, value: 'Anna Lauf' });
  });

  it('accepts 3 and 24 characters', () => {
    expect(validate(displayNameSchema, 'Ana').ok).toBe(true);
    expect(validate(displayNameSchema, 'x'.repeat(24)).ok).toBe(true);
  });

  it.each([
    ['too short after trimming', '  ab  '],
    ['too long', 'x'.repeat(25)],
    ['control characters', 'Anna\nLauf'],
  ])('rejects names that are %s', (_reason, input) => {
    expect(validate(displayNameSchema, input)).toEqual({
      ok: false,
      message: 'Der Name muss 3 bis 24 Zeichen lang sein.',
    });
  });
});
