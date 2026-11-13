/** Manual Jest mock: no photo library in tests. */
export const MediaTypeOptions = { Images: 'Images' } as const;
export const requestMediaLibraryPermissionsAsync = jest.fn(async () => ({
  granted: true,
  canAskAgain: true,
}));
export const launchImageLibraryAsync = jest.fn(async () => ({ canceled: true, assets: null }));
