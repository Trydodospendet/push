/** Manual Jest mock: there is no store in tests. */
export const isAvailableAsync = jest.fn(async () => false);
export const requestReview = jest.fn(async () => undefined);
