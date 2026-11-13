import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useMotionEnabled } from '@/features/preferences/motion';
import { de } from '@/i18n/de';
import { colors, layout, radius } from '@/theme';

import { PUSH_MAP_STYLE } from './map-style';

export type MapPoint = { lat: number; lng: number; segment: number };

type RouteMapProps = {
  points: readonly MapPoint[];
  /** Follow the last point (live run) or fit the whole route (finished run). */
  mode: 'follow' | 'fit';
  /** A framed box of this height, or (default) the whole parent as a background. */
  height?: number;
  /** Space at the bottom that a panel covers; the route is fitted into the rest. */
  bottomInset?: number;
  /** Build the line up from start to end when the route appears. */
  animate?: boolean;
};

const FOLLOW_ZOOM = 16;
// Germany, shown until the first GPS fix.
const FALLBACK_CENTER: [number, number] = [10.45, 51.16];
const REVEAL_MS = 1800;

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

/** How many points of the route are shown while it builds up (all of them without animation). */
function useRevealCount(total: number, enabled: boolean): number {
  const motionOn = useMotionEnabled();
  const [count, setCount] = useState(0);
  const animated = enabled && motionOn;

  useEffect(() => {
    if (!animated || total === 0) {
      return;
    }
    const start = Date.now();
    let frame = requestAnimationFrame(function tick() {
      const progress = Math.min(1, (Date.now() - start) / REVEAL_MS);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.max(2, Math.round(eased * total)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [animated, total]);

  return animated ? Math.min(count, total) : total;
}

/**
 * The map is part of the screen, not a box on it: PUSH's own dark style (OpenFreeMap tiles,
 * recolored), the route as a glowing lime line that builds up, a camera that follows the run
 * or glides to the whole route. Give it a `height` for a framed card, otherwise it fills its
 * parent and the content sits on top.
 */
export function RouteMap({
  points,
  mode,
  height,
  bottomInset = 0,
  animate = false,
}: RouteMapProps) {
  const shown = useRevealCount(points.length, animate && mode === 'fit');
  const visible = points.slice(0, shown);
  const last = points[points.length - 1];
  const hasRoute = points.length >= 2;
  const padding = { top: 96, right: 32, bottom: Math.max(32, bottomInset + 24), left: 32 };

  const body = (
    <Map mapStyle={PUSH_MAP_STYLE} style={styles.map} compass={false} logo={false}>
      {mode === 'fit' && hasRoute ? (
        <Camera bounds={toBounds(points)} padding={padding} />
      ) : (
        <Camera
          center={last ? [last.lng, last.lat] : FALLBACK_CENTER}
          zoom={last ? FOLLOW_ZOOM : 5}
          padding={{ top: 0, right: 0, bottom: bottomInset, left: 0 }}
        />
      )}
      <GeoJSONSource id="route" data={toGeoJson(visible)}>
        <Layer
          id="route-glow"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': colors.accent,
            'line-width': 16,
            'line-opacity': 0.18,
            'line-blur': 8,
          }}
        />
        <Layer
          id="route-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': colors.accent, 'line-width': 5 }}
        />
      </GeoJSONSource>
    </Map>
  );

  if (height === undefined) {
    return (
      <View
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityLabel={de.run.mapLabel}
        accessibilityRole="image"
      >
        {body}
      </View>
    );
  }
  return (
    <View
      style={[styles.frame, { height }]}
      accessible
      accessibilityLabel={de.run.mapLabel}
      accessibilityRole="image"
    >
      {body}
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
