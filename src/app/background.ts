/**
 * The animated swirl behind the app: a small canvas drawn from a sine field, scaled up with pixelated
 * rendering. The pattern is our own code. The colours follow the moment (see Mood).
 */

export type Rgb = readonly [number, number, number];

/** Green in a normal session and on Home, blue for a new skill, red under a minute, purple on the summary. */
export type Mood = 'green' | 'blue' | 'red' | 'purple';

/** Four colours per mood: dark, mid, light and the deepest shade. */
export const PALETTES: Record<Mood, readonly Rgb[]> = {
  green: [[24, 58, 51], [42, 106, 88], [63, 143, 116], [20, 44, 40]],
  blue: [[20, 44, 72], [34, 86, 134], [52, 124, 178], [16, 32, 56]],
  red: [[68, 26, 28], [118, 44, 44], [160, 64, 58], [46, 18, 20]],
  purple: [[44, 30, 66], [80, 58, 114], [112, 84, 150], [32, 22, 50]],
};

export const WIDTH = 78;
export const HEIGHT = 169;
/** About 20 frames a second at most. */
export const FRAME_MS = 50;
/** The slow speed from the sketch, and a quarter of it under prefers-reduced-motion. */
export const SPEED = 0.35;
export const REDUCED_SPEED = SPEED / 4;
/** Lower contrast than the full-strength sketch, so text on top stays easy to read. */
export const CONTRAST = 0.8;

/** Fill `data` (RGBA, WIDTH by HEIGHT) with the swirl at time `t`, in the given colours. */
export function renderFrame(data: Uint8ClampedArray, t: number, palette: readonly Rgb[], contrast = CONTRAST): void {
  const base = palette[0] as Rgb;
  const mixed = palette.map((c) => c.map((ch, i) => Math.round(ch * contrast + base[i]! * (1 - contrast))));
  let k = 0;
  for (let j = 0; j < HEIGHT; j++) {
    for (let i = 0; i < WIDTH; i++) {
      const u = (i - WIDTH / 2) / HEIGHT;
      const v = (j - HEIGHT * 0.45) / HEIGHT;
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u) + t * 0.12 - 2.4 * r;
      let x = r * Math.cos(a) * 7;
      let y = r * Math.sin(a) * 7;
      for (let n = 0; n < 4; n++) {
        const nx = x + 0.55 * Math.cos(1.7 + 0.45 * y + t * 0.31);
        const ny = y + 0.55 * Math.sin(0.9 * x - 0.23 * t);
        x = nx - 0.45 * Math.cos(nx + ny);
        y = ny + 0.45 * Math.sin(nx * 0.7 - ny);
      }
      const f = (Math.hypot(x, y) * 0.16 + 0.04 * Math.sin(t)) % 1;
      const c = mixed[f < 0.28 ? 0 : f < 0.55 ? 1 : f < 0.74 ? 2 : 3]!;
      data[k++] = c[0]!;
      data[k++] = c[1]!;
      data[k++] = c[2]!;
      data[k++] = 255;
    }
  }
}

/** Move each colour a share of the way from `from` to `to`. */
export function blend(from: readonly Rgb[], to: readonly Rgb[], share: number): Rgb[] {
  return from.map((c, n) => c.map((ch, i) => ch + (to[n]![i]! - ch) * share) as unknown as Rgb);
}

/** Draws the swirl onto a canvas, and keeps it throttled, paused while hidden and in the right colours. */
export class Background {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly reduced: MediaQueryList | null;
  private palette: readonly Rgb[] = PALETTES.green;
  private target: readonly Rgb[] = PALETTES.green;
  private animated = true;
  private frame = 0;
  private lastTick = -Infinity;
  private time = 0;
  private lastMs: number | null = null;
  private started = false;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.image = this.ctx.createImageData(WIDTH, HEIGHT);
    this.reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.draw();
    this.schedule();
  }

  stop(): void {
    this.started = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.cancel();
  }

  setMood(mood: Mood): void {
    this.target = PALETTES[mood];
    if (!this.animated) {
      this.palette = this.target;
      this.draw();
    } else {
      this.schedule();
    }
  }

  /** On moves the swirl. Off draws one still frame. */
  setAnimated(animated: boolean): void {
    this.animated = animated;
    if (animated) {
      this.schedule();
    } else {
      this.cancel();
      this.palette = this.target;
      this.draw();
    }
  }

  private speed(): number {
    return this.reduced?.matches ? REDUCED_SPEED : SPEED;
  }

  private draw(): void {
    renderFrame(this.image.data, this.time, this.palette);
    this.ctx.putImageData(this.image, 0, 0);
  }

  private schedule(): void {
    if (!this.started || !this.animated || document.hidden || this.frame) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private cancel(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastMs = null;
  }

  private readonly tick = (ms: number): void => {
    this.frame = 0;
    if (ms - this.lastTick >= FRAME_MS) {
      // Time is added up frame by frame, so a change of speed or a pause never makes the swirl jump.
      const dt = this.lastMs === null ? 0 : Math.min(ms - this.lastMs, 200);
      this.time += (dt / 1000) * this.speed();
      this.lastMs = ms;
      this.lastTick = ms;
      this.palette = this.reduced?.matches ? this.target : blend(this.palette, this.target, 0.12);
      this.draw();
    }
    this.schedule();
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.cancel();
    else this.schedule();
  };
}
