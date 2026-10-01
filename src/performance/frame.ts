export type Point = { x: number; y: number };
export type Frame = { x: number; y: number; width: number; height: number };
export type Edge = 'top' | 'right' | 'bottom' | 'left';
export type Crossing = { edge: Edge; point: Point; position: number; progress: number };

const between = (value: number, a: number, b: number) =>
  value >= Math.min(a, b) - 1e-9 && value <= Math.max(a, b) + 1e-9;

/** Returns boundary crossings ordered along the finger's movement. Corner duplicates collapse to one event. */
export function segmentFrameCrossings(from: Point, to: Point, frame: Frame): Crossing[] {
  const dx = to.x - from.x, dy = to.y - from.y;
  const candidates: Crossing[] = [];
  const vertical = (x: number, edge: Edge) => {
    if (Math.abs(dx) < 1e-9) return;
    const progress = (x - from.x) / dx, y = from.y + progress * dy;
    if (progress > 0 && progress <= 1 && between(y, frame.y, frame.y + frame.height))
      candidates.push({ edge, point: { x, y }, position: (y - frame.y) / frame.height, progress });
  };
  const horizontal = (y: number, edge: Edge) => {
    if (Math.abs(dy) < 1e-9) return;
    const progress = (y - from.y) / dy, x = from.x + progress * dx;
    if (progress > 0 && progress <= 1 && between(x, frame.x, frame.x + frame.width))
      candidates.push({ edge, point: { x, y }, position: (x - frame.x) / frame.width, progress });
  };
  horizontal(frame.y, 'top'); vertical(frame.x + frame.width, 'right');
  horizontal(frame.y + frame.height, 'bottom'); vertical(frame.x, 'left');
  candidates.sort((a, b) => a.progress - b.progress);
  return candidates.filter((candidate, index, all) => !index ||
    Math.hypot(candidate.point.x - all[index - 1].point.x, candidate.point.y - all[index - 1].point.y) > 1e-6);
}

export const insideFrame = (point: Point, frame: Frame, margin = 0) =>
  point.x > frame.x + margin && point.x < frame.x + frame.width - margin &&
  point.y > frame.y + margin && point.y < frame.y + frame.height - margin;

export const edgeNote = (crossing: Crossing, zones = 6) => {
  const zone = Math.min(zones - 1, Math.max(0, Math.floor(crossing.position * zones)));
  const offsets: Record<Edge, number> = { bottom: 0, left: zones, right: zones * 2, top: zones * 3 };
  return { index: offsets[crossing.edge] + zone, zone };
};

export type CrossingOptions = { cooldownMs: number; minDistance: number; hysteresis: number };
export class CrossingTracker {
  previous?: Point; private last = new Map<Edge, number>();
  constructor(public options: CrossingOptions) {}
  reset() { this.previous = undefined; }
  update(point: Point, frame: Frame, now: number): Crossing | undefined {
    const previous = this.previous; this.previous = point;
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) < this.options.minDistance) return;
    const crossing = segmentFrameCrossings(previous, point, frame)[0];
    if (!crossing || now - (this.last.get(crossing.edge) ?? -Infinity) < this.options.cooldownMs) return;
    const beforeInside = insideFrame(previous, frame, this.options.hysteresis);
    const afterInside = insideFrame(point, frame, this.options.hysteresis);
    if (beforeInside === afterInside) return;
    this.last.set(crossing.edge, now); return crossing;
  }
}
