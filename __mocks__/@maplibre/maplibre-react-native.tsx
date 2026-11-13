import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Manual Jest mock: the real map is a native view. */
export function Map({ children }: { children?: ReactNode }) {
  return <View testID="map">{children}</View>;
}
export function Camera() {
  return null;
}
export function GeoJSONSource({ children }: { children?: ReactNode }) {
  return <View>{children}</View>;
}
export function Layer() {
  return null;
}
