/** Manual Jest mock: views are not captured in tests. */
export const captureRef = jest.fn(async () => 'file:///tmp/share.png');
