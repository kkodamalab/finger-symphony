import { it, expect, vi } from "vitest";
import { EventLooper, equalPower, type LoopEvent } from "./looper";
const event: Omit<LoopEvent, "beat"> = {
  edge: "top",
  segment: 1,
  velocity: 0.6,
  genre: "band",
  sound: "genre",
  kind: "HIT",
  duration: 0,
};
it("records, auto-plays, and repeats on a shared beat clock", () => {
  const emit = vi.fn(),
    l = new EventLooper(emit, vi.fn());
  l.setBars(1);
  l.record(10);
  l.capture(event, 11);
  for (let b = 10; b <= 15; b += 0.25) l.tick(b);
  expect(l.state).toBe("PLAYING");
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit.mock.calls[0][1]).toBe(15);
  for (let b = 15.25; b <= 19; b += 0.25) l.tick(b);
  expect(emit).toHaveBeenCalledTimes(2);
});
it("overdubs without deleting earlier events and never records replay", () => {
  const l = new EventLooper(vi.fn(), vi.fn());
  l.record(0);
  l.capture(event, 1);
  l.play(4);
  l.overdub(4);
  l.capture({ ...event, segment: 2 }, 5);
  l.capture(event, 6, "loop");
  expect(l.events.map((e) => e.segment)).toEqual([1, 2]);
  l.overdub(7);
  expect(l.state).toBe("PLAYING");
});
it("keeps A/B recording and playback independent", () => {
  const a = new EventLooper(vi.fn(), vi.fn()),
    b = new EventLooper(vi.fn(), vi.fn());
  a.record(0);
  b.play(0);
  a.capture(event, 1);
  b.capture(event, 1);
  a.stop();
  expect(b.state).toBe("PLAYING");
  expect(a.events).toHaveLength(1);
  expect(b.events).toHaveLength(0);
});
it("stop/clear release voices and prevent future playback", () => {
  const emit = vi.fn(),
    release = vi.fn(),
    l = new EventLooper(emit, release);
  l.record(0);
  l.capture(event, 1);
  l.play(0);
  l.stop();
  l.tick(1);
  expect(emit).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalled();
  l.clear();
  expect(l.events).toEqual([]);
});
it("records drone duration and releases on the recorded beat", () => {
  const emit = vi.fn(),
    l = new EventLooper(emit, vi.fn());
  l.record(0);
  l.capture({ ...event, genre: "drone", kind: "ON", duration: 16 }, 1);
  l.capture({ ...event, genre: "drone", kind: "OFF" }, 3);
  expect(l.events[0].duration).toBe(2);
  l.play(0);
  for (let b = 0; b <= 3; b += 0.25) l.tick(b);
  expect(emit.mock.calls.some(([e]) => e.kind === "OFF")).toBe(true);
});
it("bounds memory, validates lengths, and does not burst stale events after suspension", () => {
  const emit = vi.fn(),
    l = new EventLooper(emit, vi.fn());
  l.setBars(3);
  expect(l.bars).toBe(4);
  l.record(0);
  for (let i = 0; i < 5000; i++) l.capture(event, 1);
  expect(l.events.length).toBe(4096);
  l.play(0);
  l.tick(100);
  expect(emit).not.toHaveBeenCalled();
});
it("uses equal-power fade with exact endpoint isolation", () => {
  expect(equalPower(0)).toEqual([1, 0]);
  expect(equalPower(1)[0]).toBeCloseTo(0);
  expect(equalPower(0.5)[0]).toBeCloseTo(Math.SQRT1_2);
  for (let i = 0; i <= 10; i++) {
    const [a, b] = equalPower(i / 10);
    expect(a * a + b * b).toBeCloseTo(1);
  }
});
it("carries a drone duration across the loop boundary without toggling it off early", () => {
  const emit = vi.fn(),
    release = vi.fn(),
    l = new EventLooper(emit, release);
  l.setBars(1);
  l.record(0);
  l.capture({ ...event, genre: "drone", kind: "ON", duration: 2 }, 3);
  l.play(0);
  release.mockClear();
  for (let b = 0; b <= 5; b += 0.25) l.tick(b);
  const on = emit.mock.calls
    .filter(([e]) => e.kind === "ON")
    .map(([, beat]) => beat);
  const off = emit.mock.calls
    .filter(([e]) => e.kind === "OFF")
    .map(([, beat]) => beat);
  expect(on).toEqual([0, 3]);
  expect(off).toEqual([1, 5]);
  expect(release).not.toHaveBeenCalled();
});
