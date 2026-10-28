import { describe, it, expect, vi } from "vitest";
import {
  PRESETS,
  cameraConstraints,
  loadPerformance,
  savePerformance,
  TrackingLifecycle,
  InferenceBudget,
  PerformanceMeter,
  activeMetric,
} from "./runtime";
const model = () => ({ init: vi.fn(async () => {}), close: vi.fn() });
describe("Playground tracking lifecycle", () => {
  it("defaults to Hands only without initializing Pose", async () => {
    const h = model(),
      p = model(),
      t = new TrackingLifecycle(h, p);
    await t.start("hands");
    expect(h.init).toHaveBeenCalledOnce();
    expect(p.init).not.toHaveBeenCalled();
    expect(t.state).toBe("ON");
  });
  it("initializes Body Contact and releases both models when switching back", async () => {
    const h = model(),
      p = model(),
      t = new TrackingLifecycle(h, p);
    await t.start("body");
    expect(p.init).toHaveBeenCalledOnce();
    await t.start("hands");
    expect(p.init).toHaveBeenCalledOnce();
    expect(p.close).toHaveBeenCalledTimes(2);
    expect(h.close).toHaveBeenCalledTimes(2);
    t.stop();
    expect(t.state).toBe("INACTIVE");
  });
  it("invalidates stale requests and serializes pending initialization", async () => {
    const h = model(),
      p = model(),
      t = new TrackingLifecycle(h, p);
    let release!: () => void;
    h.init.mockImplementationOnce(
      () => new Promise<void>((r) => (release = r)),
    );
    const old = t.start("body");
    await Promise.resolve();
    await Promise.resolve();
    const next = t.start("hands");
    expect(h.init).toHaveBeenCalledOnce();
    release();
    await Promise.all([old, next]);
    expect(h.init).toHaveBeenCalledTimes(2);
    expect(p.init).not.toHaveBeenCalled();
    expect(t.state).toBe("ON");
  });
  it("does not activate Pose after stop during Hands initialization", async () => {
    const h = model(),
      p = model(),
      t = new TrackingLifecycle(h, p);
    let release!: () => void;
    h.init.mockImplementationOnce(
      () => new Promise<void>((r) => (release = r)),
    );
    const pending = t.start("body");
    await Promise.resolve();
    await Promise.resolve();
    t.stop();
    release();
    await pending;
    expect(p.init).not.toHaveBeenCalled();
    expect(t.state).toBe("INACTIVE");
  });
  it("reports initialization errors and allows recovery", async () => {
    const h = model(),
      p = model(),
      t = new TrackingLifecycle(h, p);
    p.init.mockRejectedValueOnce(Error("model failure"));
    await expect(t.start("body")).rejects.toThrow("model failure");
    expect(t.state).toBe("ERROR");
    await t.start("hands");
    expect(t.state).toBe("ON");
  });
});
describe("performance budget and measurement", () => {
  it.each(["quality", "balanced", "light"] as const)(
    "applies %s camera constraints and limits inference without backlog",
    (preset) => {
      const p = PRESETS[preset],
        b = new InferenceBudget(),
        calls = { hands: 0, pose: 0 };
      expect(cameraConstraints(preset)).toEqual({
        width: { ideal: p.width },
        height: { ideal: p.height },
      });
      for (let i = 0; i < 600; i++)
        b.run(
          (i * 1000) / 60,
          i / 60,
          preset,
          { hands: true, pose: true },
          (k) => calls[k]++,
        );
      expect(calls.hands).toBeLessThanOrEqual(p.handsFps * 10 + 1);
      expect(calls.pose).toBeLessThanOrEqual(p.poseFps * 10 + 1);
      expect(calls.hands).toBeGreaterThan(p.handsFps * 6);
      const before = calls.hands + calls.pose;
      b.run(
        100000,
        100,
        preset,
        { hands: true, pose: true },
        (k) => calls[k]++,
      );
      expect(calls.hands + calls.pose - before).toBe(1);
    },
  );
  it("never runs nested inference or reprocesses a stale frame", () => {
    const b = new InferenceBudget(),
      cb = vi.fn();
    b.run(0, 1, "quality", { hands: true, pose: false }, () =>
      b.run(100, 2, "quality", { hands: true, pose: true }, cb),
    );
    b.run(1000, 1, "quality", { hands: true, pose: false }, cb);
    expect(cb).not.toHaveBeenCalled();
  });
  it("calculates actual rates and inference time over the measured interval", () => {
    const m = new PerformanceMeter(0);
    m.frame(0);
    m.frame(80);
    m.render();
    m.render();
    m.inference("hands", 12);
    m.inference("hands", 8);
    m.inference("pose", 30);
    expect(m.sample(2000)).toEqual({
      renderFps: 1,
      handsFps: 1,
      poseFps: 0.5,
      handsMs: 10,
      poseMs: 30,
      totalMs: 50,
      windowMs: 2000,
    });
    expect(m.longFrames).toBe(1);
    expect(m.sample(3000).handsMs).toBeNull();
  });
  it("shows INACTIVE rather than zero FPS for a stopped model", () => {
    expect(activeMetric(false, 0)).toBe("INACTIVE");
    expect(activeMetric(true, null)).toBe("N/A");
  });
  it("preserves safe defaults and restores only recognized settings", () => {
    const storage = {
      getItem: vi.fn(() => null as string | null),
      setItem: vi.fn(),
    };
    expect(loadPerformance(storage)).toEqual({
      engine: "hands",
      preset: "balanced",
    });
    savePerformance({ engine: "body", preset: "light" }, storage);
    storage.getItem.mockReturnValue(storage.setItem.mock.calls[0][1]);
    expect(loadPerformance(storage)).toEqual({
      engine: "body",
      preset: "light",
    });
    storage.getItem.mockReturnValue(
      '{"engine":"unknown","preset":"__proto__"}',
    );
    expect(loadPerformance(storage)).toEqual({
      engine: "hands",
      preset: "balanced",
    });
  });
});
