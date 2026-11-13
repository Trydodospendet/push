/** Manual Jest mock: images are not processed in tests. */
export const SaveFormat = { JPEG: 'jpeg' } as const;
export const manipulateAsync = jest.fn(async (uri: string) => ({ uri, width: 256, height: 256 }));
