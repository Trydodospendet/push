/** Manual Jest mock: nothing is spoken in tests. */
export const speak = jest.fn();
export const stop = jest.fn(async () => undefined);
