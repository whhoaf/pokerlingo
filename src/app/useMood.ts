import { useEffect } from 'preact/hooks';
import type { Background, Mood } from './background';

let background: Background | null = null;

/** App hands over the background it created, so screens can set its colours. */
export function registerBackground(bg: Background | null): void {
  background = bg;
  // A screen that mounted first would have asked before the canvas existed, so ask again.
  if (bg && wanted) bg.setMood(wanted);
}

let wanted: Mood | null = null;

/** Colour the background for as long as the calling screen is shown. Back to green when it goes. */
export function useMood(mood: Mood): void {
  useEffect(() => {
    wanted = mood;
    background?.setMood(mood);
    return () => {
      wanted = 'green';
      background?.setMood('green');
    };
  }, [mood]);
}
