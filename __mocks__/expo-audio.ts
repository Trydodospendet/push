/** Manual Jest mock: nothing is played in tests. */
export const createAudioPlayer = jest.fn(() => ({
  seekTo: jest.fn(async () => undefined),
  play: jest.fn(),
}));
export type AudioPlayer = ReturnType<typeof createAudioPlayer>;
