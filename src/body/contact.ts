import type { Edge, Frame, Point } from "../performance/frame";
import type { Hand } from "../tracking/hands";
export type Landmark = Point & { z?: number; visibility?: number };
export type Geometry = {
  source: string;
  region: string;
  points: Point[];
  closed?: boolean;
  confidence: number;
};
export type BodyContactEvent = {
  timestamp: number;
  deckId: string;
  edge: Edge;
  segmentIndex: number;
  contactId: string;
  bodyRegion: string;
  contactPosition: Point;
  velocity: number;
  confidence: number;
  eventType: "ENTER" | "HOLD" | "EXIT";
};
export type ContactTarget = { deckId: string; frame: Frame; segments: number };
export const edges: Edge[] = ["top", "bottom", "left", "right"];
const visible = (p: Landmark | undefined): p is Landmark =>
  !!p &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  (p.visibility ?? 1) >= 0.6;
const chains: [string, number[]][] = [
  ["head", [0, 1, 2, 3, 7, 9, 10, 8, 6, 5, 4]],
  ["torso", [11, 12, 24, 23]],
  ["left-upper-arm", [11, 13]],
  ["right-upper-arm", [12, 14]],
  ["left-forearm", [13, 15]],
  ["right-forearm", [14, 16]],
  ["left-hand", [15, 17, 19, 21]],
  ["right-hand", [16, 18, 20, 22]],
  ["hips", [23, 24]],
  ["left-thigh", [23, 25]],
  ["right-thigh", [24, 26]],
  ["left-shin", [25, 27]],
  ["right-shin", [26, 28]],
  ["left-foot", [27, 29, 31]],
  ["right-foot", [28, 30, 32]],
];
export function bodyGeometry(
  pose: Landmark[],
  hands: Hand[],
  mirror = false,
  suppressed = new Set<string>(),
): Geometry[] {
  const result: Geometry[] = [];
  const project = (p: Point) => ({ x: mirror ? 1 - p.x : p.x, y: p.y });
  for (const [region, indices] of chains) {
    if (suppressed.has(region)) continue;
    const ps = indices.map((i) => pose[i]);
    // Never bridge an occluded joint or turn a partial torso into a filled surface.
    if (ps.every((p) => visible(p))) {
      result.push({
        source: region,
        region,
        points: ps.map(project),
        closed: [
          "head",
          "torso",
          "left-hand",
          "right-hand",
          "left-foot",
          "right-foot",
        ].includes(region),
        confidence: Math.min(...ps.map((p) => p.visibility ?? 1)),
      });
    } else
      for (const p of ps.filter(visible))
        result.push({
          source: region,
          region,
          points: [project(p)],
          confidence: p.visibility ?? 1,
        });
  }
  for (const hand of hands) {
    const region = hand.side.toLowerCase() + "-hand";
    if (suppressed.has(region)) continue;
    const ps = hand.points;
    for (const indices of [
      [0, 1, 2, 3, 4],
      [0, 5, 6, 7, 8],
      [0, 9, 10, 11, 12],
      [0, 13, 14, 15, 16],
      [0, 17, 18, 19, 20],
      [0, 5, 9, 13, 17],
    ])
      if (indices.every((i) => visible(ps[i])))
        result.push({
          source: region,
          region,
          points: indices.map((i) => project(ps[i])),
          closed: indices.length === 5 && indices[1] === 5 && indices[2] === 9,
          confidence: 1,
        });
  }
  return result;
}
export function cellFrame(target: ContactTarget, edge: Edge, i: number): Frame {
  const f = target.frame,
    n = target.segments;
  return edge === "top" || edge === "bottom"
    ? {
        x: f.x + (f.width * i) / n,
        y: f.y + (edge === "bottom" ? f.height : 0),
        width: f.width / n,
        height: 0,
      }
    : {
        x: f.x + (edge === "right" ? f.width : 0),
        y: f.y + (f.height * i) / n,
        width: 0,
        height: f.height / n,
      };
}
function inside(p: Point, r: Frame) {
  return (
    p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
  );
}
function lineRect(a: Point, b: Point, r: Frame) {
  let lo = 0,
    hi = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x - r.x],
    [dx, r.x + r.width - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.height - a.y],
  ]) {
    if (Math.abs(p) < 1e-10) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) lo = Math.max(lo, t);
      else hi = Math.min(hi, t);
      if (lo > hi) return false;
    }
  }
  return true;
}
function inPolygon(p: Point, points: Point[]) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      hit = !hit;
  }
  return hit;
}
export function intersects(g: Geometry, cell: Frame, padding: number) {
  const r = {
    x: cell.x - padding,
    y: cell.y - padding,
    width: cell.width + 2 * padding,
    height: cell.height + 2 * padding,
  };
  if (g.points.some((p) => inside(p, r))) return true;
  for (let i = 1; i < g.points.length; i++)
    if (lineRect(g.points[i - 1], g.points[i], r)) return true;
  if (g.closed && g.points.length >= 3)
    return (
      lineRect(g.points.at(-1)!, g.points[0], r) ||
      inPolygon(
        { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 },
        g.points,
      )
    );
  return false;
}
type State = {
  active: boolean;
  since: number;
  outside?: number;
  lastExit: number;
  sources: Set<string>;
  blocked: boolean;
  position?: Point;
  lastAt: number;
};
/** One contact per deck/edge/segment, regardless of overlapping Pose/Hands primitives. */
export class BodyContacts {
  private cells = new Map<string, State>();
  private last = -Infinity;
  reset() {
    this.cells.clear();
    this.last = -Infinity;
  }
  update(
    geometry: Geometry[],
    targets: ContactTarget[],
    now: number,
    options = {
      contactDistance: 0.02,
      contactTime: 100,
      hysteresis: 0.008,
      cooldown: 200,
    },
  ): BodyContactEvent[] {
    if (now <= this.last) return [];
    const gap = Number.isFinite(this.last) && now - this.last > 500;
    this.last = now;
    const observed = new Set(geometry.map((g) => g.source)),
      events: BodyContactEvent[] = [];
    for (const target of targets)
      for (const edge of edges)
        for (let i = 0; i < target.segments; i++) {
          const key = `${target.deckId}:${edge}:${i}`,
            cell = cellFrame(target, edge, i);
          let s = this.cells.get(key);
          if (!s) {
            s = {
              active: false,
              since: now,
              lastExit: -Infinity,
              sources: new Set(),
              blocked: gap,
              lastAt: now,
            };
            this.cells.set(key, s);
          }
          if (gap) {
            s.blocked = true;
            s.since = now;
            s.outside = undefined;
          }
          const hits = geometry.filter((g) =>
            intersects(
              g,
              cell,
              options.contactDistance + (s.active ? options.hysteresis : 0),
            ),
          );
          if (!geometry.length) {
            s.blocked = true;
            s.since = now;
            s.outside = undefined;
            continue;
          }
          if (!hits.length) {
            // Missing limbs are not evidence of release; require an observed departure.
            if (
              s.sources.size &&
              ![...s.sources].every((id) => observed.has(id))
            ) {
              s.blocked = true;
              s.since = now;
              continue;
            }
            s.outside ??= now;
            s.since = now;
            if (now - s.outside < 120) continue;
            if (s.active)
              events.push({
                timestamp: now,
                deckId: target.deckId,
                edge,
                segmentIndex: i,
                contactId: key,
                bodyRegion: [...s.sources].join(","),
                contactPosition: s.position ?? { x: cell.x, y: cell.y },
                velocity: 0,
                confidence: 1,
                eventType: "EXIT",
              });
            if (s.active) s.lastExit = now;
            s.active = false;
            s.blocked = false;
            s.sources.clear();
            continue;
          }
          s.outside = undefined;
          s.sources = new Set(hits.map((g) => g.source));
          const point = hits
              .flatMap((h) => h.points)
              .reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), {
                x: 0,
                y: 0,
              }),
            count = hits.reduce((n, h) => n + h.points.length, 0);
          point.x /= count;
          point.y /= count;
          const velocity = s.position
            ? Math.min(
                1,
                (Math.hypot(point.x - s.position.x, point.y - s.position.y) *
                  1000) /
                  Math.max(1, now - s.lastAt),
              )
            : 0.5;
          s.position = point;
          s.lastAt = now;
          if (s.blocked) continue;
          if (
            !s.active &&
            (now - s.since < options.contactTime ||
              now - s.lastExit < options.cooldown)
          )
            continue;
          events.push({
            timestamp: now,
            deckId: target.deckId,
            edge,
            segmentIndex: i,
            contactId: key,
            bodyRegion: [...new Set(hits.map((h) => h.region))].join(","),
            contactPosition: point,
            velocity,
            confidence: Math.min(...hits.map((h) => h.confidence)),
            eventType: s.active ? "HOLD" : "ENTER",
          });
          s.active = true;
        }
    return events;
  }
}

/** Use a unique nearby Pose wrist for anatomical side; never assign decks by handedness. */
export function associateHands(hands: Hand[], pose: Landmark[]): Hand[] {
  const candidates = hands.map((h) =>
    [15, 16]
      .map((i, index) => ({
        index,
        d:
          visible(pose[i]) && h.points[0]
            ? Math.hypot(h.points[0].x - pose[i].x, h.points[0].y - pose[i].y)
            : Infinity,
      }))
      .sort((a, b) => a.d - b.d),
  );
  return hands.map((h, i) => {
    const best = candidates[i][0],
      other = candidates[i][1];
    if (
      best.d > 0.13 ||
      other.d - best.d < 0.035 ||
      candidates.some(
        (r, j) => j !== i && r[0].index === best.index && r[0].d < 0.13,
      )
    )
      return h;
    return { ...h, side: best.index === 0 ? "Left" : "Right" };
  });
}
