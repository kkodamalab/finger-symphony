import { it, expect } from "vitest";
import { BodyGestures, handShape } from "./gestures";
import type { Hand } from "../tracking/hands";
function hand(
  shape: "open" | "fist" | "peace" | "pinch",
  x = 0.25,
  y = 0.9,
): Hand {
  const p = Array.from({ length: 21 }, () => ({ x, y: y - 0.02, z: 0 }));
  p[0] = { x, y, z: 0 };
  p[9] = { x, y: y - 0.08, z: 0 };
  [8, 12, 16, 20].forEach((i, n) => {
    p[i - 2] = { x: x + (n - 1) * 0.02, y: y - 0.05, z: 0 };
    p[i] = {
      x: x + (n - 1) * 0.02,
      y: y - (shape === "open" || (shape === "peace" && n < 2) ? 0.13 : 0.02),
      z: 0,
    };
  });
  p[4] = { x: x - 0.12, y: y - 0.02, z: 0 };
  if (shape === "pinch") p[4] = { ...p[8] };
  return { side: "Left", points: p };
}
it.each(["open", "fist", "peace", "pinch"] as const)(
  "recognizes %s relative to palm size",
  (shape) => expect(handShape(hand(shape))).toBe(shape),
);
it("requires hold, emits only once until release, and marks the target deck", () => {
  const g = new BodyGestures();
  g.enabled = true;
  expect(g.update([hand("open")], 0, false).actions).toEqual([]);
  const result = g.update([hand("open")], 100, false);
  expect(result.suppressed.has("left-hand")).toBe(true);
  for (let t = 200; t < 1000; t += 100) g.update([hand("open")], t, false);
  expect(g.update([hand("open")], 1000, false).actions).toEqual([
    { deck: "A", action: "REC" },
  ]);
  expect(g.update([hand("open")], 1100, false).actions).toEqual([]);
});
it("does not treat gestures in the performance area as transport controls", () => {
  const g = new BodyGestures();
  g.enabled = true;
  for (let t = 0; t < 2000; t += 100)
    expect(g.update([hand("open", 0.25, 0.5)], t, false).actions).toEqual([]);
});
it("locks the first pinching hand and releases on loss", () => {
  const g = new BodyGestures();
  g.enabled = true;
  const a = hand("pinch", 0.2),
    b = { ...hand("pinch", 0.8), side: "Right" as const };
  const result = g.update([a, b], 0, false);
  expect(result.fade).toBeLessThan(0.5);
  expect(result.suppressed.has("left-forearm")).toBe(true);
  expect(g.update([], 100, false).fade).toBeUndefined();
  expect(g.update([b], 200, false).fade).toBeGreaterThan(0.5);
});
it("disabled gestures do not suppress playing and tracking gaps reset holds", () => {
  const g = new BodyGestures();
  expect(g.update([hand("open")], 0, false).suppressed.size).toBe(0);
  g.enabled = true;
  g.update([hand("open")], 0, false);
  expect(g.update([hand("open")], 2000, false).actions).toEqual([]);
});
