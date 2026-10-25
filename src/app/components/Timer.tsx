import { useEffect, useState } from 'preact/hooks';
import { formatClock } from '../format';

interface Props {
  remainingMs(): number;
  totalMs: number;
}

/** The session clock. At zero the current question can still be finished. */
export function Timer({ remainingMs, totalMs }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const left = remainingMs();
  const fraction = totalMs > 0 ? Math.min(left / totalMs, 1) : 0;
  const low = left <= 60_000;
  return (
    <div class={low ? 'timer timer--low' : 'timer'}>
      <div class="timer-clock" role="timer" aria-label="Time left">
        {left === 0 ? 'Time is up' : formatClock(left)}
      </div>
      <div class="timer-bar" aria-hidden="true">
        <div class="timer-fill" style={`width:${(fraction * 100).toFixed(1)}%`} />
      </div>
    </div>
  );
}
