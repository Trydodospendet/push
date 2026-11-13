import { useEffect, useRef, useState } from 'react';

import { useMotionEnabled } from '@/features/preferences/motion';

import { Text, type TextProps } from './text';

export type CountUpProps = Omit<TextProps, 'children'> & {
  /** The target value. */
  value: number;
  /** Turns the running value into text, e.g. `formatAmount`. */
  format: (value: number) => string;
  durationMs?: number;
};

/**
 * A number that counts up from its previous value to the new one. Without animations (own
 * switch or system "reduce motion") it shows the final value right away. The accessibility
 * label always carries the final value, never an in-between one.
 */
export function CountUp({
  value,
  format,
  durationMs = 700,
  accessibilityLabel,
  ...rest
}: CountUpProps) {
  const motionOn = useMotionEnabled();
  const [shown, setShown] = useState(motionOn ? 0 : value);
  const from = useRef(motionOn ? 0 : value);

  useEffect(() => {
    if (!motionOn) {
      from.current = value;
      return;
    }
    const start = Date.now();
    const origin = from.current;
    let frame: ReturnType<typeof requestAnimationFrame> | null = null;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setShown(origin + (value - origin) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        from.current = value;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [durationMs, motionOn, value]);

  return (
    <Text accessibilityLabel={accessibilityLabel ?? format(value)} {...rest}>
      {format(Math.round(motionOn ? shown : value))}
    </Text>
  );
}
