/** Manual Jest mock: there is no share menu in tests. */
export const isAvailableAsync = jest.fn(async () => true);
export const shareAsync = jest.fn(async () => undefined);
