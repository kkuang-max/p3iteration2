// Turns a stream of hand positions into discrete up / down / left / right swipes.

export type SwipeDir = "up" | "down" | "left" | "right";

export type SwipeOptions = {
  windowMs: number; // look this far back for the movement
  distance: number; // minimum travel, in frame heights
  dominance: number; // main axis must beat the other axis by this factor
  cooldownMs: number; // ignore everything for this long after a swipe
  reverseLockMs: number; // ignore the opposite direction this long (the hand coming back)
};

export const DEFAULT_SWIPE: SwipeOptions = {
  windowMs: 280,
  distance: 0.22,
  dominance: 1.6,
  cooldownMs: 450,
  reverseLockMs: 900,
};

const OPPOSITE: Record<SwipeDir, SwipeDir> = { up: "down", down: "up", left: "right", right: "left" };

export type Swipe = { dir: SwipeDir; dx: number; dy: number };

export class SwipeDetector {
  private pts: { t: number; x: number; y: number }[] = [];
  private lockUntil = 0;
  private last: { dir: SwipeDir; t: number } | null = null;

  constructor(private o: SwipeOptions = DEFAULT_SWIPE) {}

  /** x and y in frame-height units (multiply normalised x by the video aspect). */
  push(t: number, x: number, y: number): Swipe | null {
    this.pts.push({ t, x, y });
    while (this.pts.length && t - this.pts[0].t > this.o.windowMs) this.pts.shift();
    if (t < this.lockUntil || this.pts.length < 2) return null;

    const first = this.pts[0];
    const dx = x - first.x;
    const dy = y - first.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < this.o.distance) return null;

    let dir: SwipeDir | null = null;
    if (ax > ay * this.o.dominance) dir = dx > 0 ? "right" : "left";
    else if (ay > ax * this.o.dominance) dir = dy > 0 ? "down" : "up";
    if (!dir) return null; // diagonal: too ambiguous to act on

    this.pts = [];
    if (this.last && dir === OPPOSITE[this.last.dir] && t - this.last.t < this.o.reverseLockMs) return null;
    this.last = { dir, t };
    this.lockUntil = t + this.o.cooldownMs;
    return { dir, dx, dy };
  }
}
