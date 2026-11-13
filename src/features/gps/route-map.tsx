import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { MAP_STYLE_URL } from '@/config/app';
import { de } from '@/i18n/de';
import { colors, layout, radius } from '@/theme';

export type MapPoint = { lat: number; lng: number; segment: number };

type RouteMapProps = {
  points: readonly MapPoint[];
  /** Follow the last point (live run) or fit the whole route (finished run). */
  mode: 'follow' | 'fit';
  height?: number;
};

const FOLLOW_ZOOM = 16;
// Germany, shown until the first GPS fix.
const FALLBACK_CENTER: [number, number] = [10.45, 51.16];

/** One line per segment, so a pause is not drawn as a straight connection. */
function toGeoJson(points: readonly MapPoint[]): GeoJSON.FeatureCollection {
  const lines: [number, number][][] = [];
  let current: [number, number][] = [];
  let segment = points[0]?.segment ?? 0;
  for (const point of points) {
    if (point.segment !== segment) {
      lines.push(current);
      current = [];
      segment = point.segment;
    }
    current.push([point.lng, point.lat]);
  }
  lines.push(current);
  return {
    type: 'FeatureCollection',
    features: lines
      .filter((line) => line.length >= 2)
      .map((coordinates) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      })),
  };
}

function toBounds(points: readonly MapPoint[]): [number, number, number, number] {
  const lngs = points.map((point) => point.lng);
  const lats = points.map((point) => point.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/** OpenFreeMap (no API key) with the route as a lime line. */
export function RouteMap({ points, mode, height = 280 }: RouteMapProps) {
  const last = points[points.length - 1];
  const hasRoute = points.length >= 2;

  return (
    <View
      style={[styles.frame, { height }]}
      accessible
      accessibilityLabel={de.run.mapLabel}
      accessibilityRole="image"
    >
      <Map mapStyle={MAP_STYLE_URL} style={styles.map} compass={false}>
        {mode === 'fit' && hasRoute ? (
          <Camera
            bounds={toBounds(points)}
            padding={{ top: 32, right: 32, bottom: 32, left: 32 }}
          />
        ) : (
          <Camera
            center={last ? [last.lng, last.lat] : FALLBACK_CENTER}
            zoom={last ? FOLLOW_ZOOM : 5}
          />
        )}
        <GeoJSONSource id="route" data={toGeoJson(points)}>
          <Layer
            id="route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.accent, 'line-width': 5 }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: radius.card,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
    backgroundColor: colors.surface,
  },
  map: {
    flex: 1,
  },
});
