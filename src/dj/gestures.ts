import type { Hand } from "../tracking/hands";
import type { Point } from "../performance/frame";
export type GestureAction = {
  deck: "A" | "B";
  action: "REC" | "PLAY_STOP" | "OVERDUB";
};
const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function handShape(hand: Hand) {
  const p = hand.points;
  if (p.length < 21) return "none";
  const scale = Math.max(0.01, d(p[0], p[9]));
  const raised = [8, 12, 16, 20].map(
    (i) => d(p[i], p[0]) > d(p[i - 2], p[0]) * 1.18,
  );
  if (d(p[4], p[8]) / scale < 0.32) return "pinch";
  if (raised.every(Boolean)) return "open";
  if (raised.every((x) => !x)) return "fist";
  if (raised[0] && raised[1] && !raised[2] && !raised[3]) return "peace";
  return "none";
}
export class BodyGestures {
  enabled = false;
  holdMs = 1000;
  cooldown = 1800;
  status = "GESTURES OFF";
  private lock?: Hand["side"];
  private pending = new Map<
    string,
    { shape: string; since: number; fired: boolean; last: number }
  >();
  private next = 0;
  reset() {
    this.lock = undefined;
    this.pending.clear();
    this.status = this.enabled ? "GESTURES READY" : "GESTURES OFF";
  }
  update(hands: Hand[], now: number, mirror: boolean) {
    const suppressed = new Set<string>(),
      actions: GestureAction[] = [];
    let fade: number | undefined;
    if (!this.enabled) {
      this.reset();
      return { suppressed, actions, fade };
    }
    const display = (p: Point) => ({ x: mirror ? 1 - p.x : p.x, y: p.y });
    if (
      this.lock &&
      !hands.some((h) => h.side === this.lock && handShape(h) === "pinch")
    )
      this.lock = undefined;
    this.status = "GESTURES READY";
    for (const h of hands) {
      const p = display(h.points[0]),
        shape = handShape(h),
        region = h.side.toLowerCase();
      if (
        shape === "pinch" &&
        (this.lock === h.side ||
          (!this.lock && p.y >= 0.84 && p.x >= 0.05 && p.x <= 0.95))
      )
        this.lock = h.side;
      if (this.lock === h.side) {
        fade = Math.max(0, Math.min(1, (display(h.points[8]).x - 0.08) / 0.84));
        suppressed.add(region + "-hand");
        suppressed.add(region + "-forearm");
        this.status = `FADER · ${h.side.toUpperCase()} LOCK`;
        continue;
      }
      // Commands live in the marked control strip, not in the performance field.
      const deck = p.x < 0.5 ? "A" : "B";
      if (p.y < 0.84 || !["open", "fist", "peace"].includes(shape)) {
        this.pending.delete(h.side);
        continue;
      }
      suppressed.add(region + "-hand");
      suppressed.add(region + "-forearm");
      const id = shape + deck;
      let state = this.pending.get(h.side);
      if (!state || state.shape !== id || now - state.last > 300) {
        state = { shape: id, since: now, fired: false, last: now };
        this.pending.set(h.side, state);
      }
      state.last = now;
      this.status = `DECK ${deck} · ${shape.toUpperCase()} ${Math.min(100, Math.round(((now - state.since) / this.holdMs) * 100))}%`;
      if (state.fired) this.status = `DECK ${deck} · ${shape.toUpperCase()} ✓`;
      if (
        !state.fired &&
        now - state.since >= this.holdMs &&
        now >= this.next
      ) {
        state.fired = true;
        this.next = now + this.cooldown;
        actions.push({
          deck,
          action:
            shape === "open"
              ? "REC"
              : shape === "fist"
                ? "PLAY_STOP"
                : "OVERDUB",
        });
        this.status = `DECK ${deck} · ${shape.toUpperCase()} ✓`;
      }
    }
    for (const [side, s] of this.pending)
      if (now - s.last > 300) this.pending.delete(side);
    return { suppressed, actions, fade };
  }
}
