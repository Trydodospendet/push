import { useCallback, useEffect, useState } from 'react';

/**
 * Counts down from `seconds` to 0 (for "send the code again"). `restart` begins again.
 * Returns the seconds left; the interval only runs while there is something left to count.
 */
export function useCountdown(seconds: number): { left: number; restart: () => void } {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [endsAt]);

  const restart = useCallback(() => {
    setEndsAt(Date.now() + seconds * 1000);
    setLeft(seconds);
  }, [seconds]);

  return { left, restart };
}
