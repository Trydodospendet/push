import type { ConfigContext } from 'expo/config';

// The ".ts" extension is required: Expo CLI loads this file with Node.js, which only resolves
// TypeScript imports that spell out their extension.
import { APP_NAME } from './src/config/app.ts';

/**
 * Static settings live in app.json. This file only injects the app name so that it is
 * defined in exactly one place (src/config/app.ts).
 */
export default ({ config }: ConfigContext) => ({
  ...config,
  name: APP_NAME,
});
