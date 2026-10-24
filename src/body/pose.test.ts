import { beforeEach, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  resolve: vi.fn(async () => ({})),
  create: vi.fn(),
  model: { close: vi.fn(), detectForVideo: vi.fn(() => ({ landmarks: [] })) },
}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: f.resolve },
  PoseLandmarker: { createFromOptions: f.create },
}));
import { BodyPose } from "./pose";
beforeEach(() => {
  vi.clearAllMocks();
  f.create.mockResolvedValue(f.model);
});
it("falls back from GPU to CPU with the pinned WASM runtime", async () => {
  f.create.mockRejectedValueOnce(Error("GPU unavailable"));
  const p = new BodyPose();
  await p.init();
  expect(f.resolve).toHaveBeenCalledWith(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
  );
  expect(f.create.mock.calls[1][1].baseOptions.delegate).toBe("CPU");
  expect(p.model).toBe(f.model);
  p.close();
});
it("closes a model that resolves after camera stop", async () => {
  let resolve!: (v: unknown) => void;
  f.create.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
  const p = new BodyPose(),
    pending = p.init();
  await Promise.resolve();
  p.close();
  resolve(f.model);
  await pending;
  expect(f.model.close).toHaveBeenCalledTimes(1);
  expect(p.model).toBeUndefined();
});
it("never repeats inference for the same video frame and caps update frequency", async () => {
  const p = new BodyPose();
  await p.init();
  const v = { currentTime: 1 } as HTMLVideoElement;
  p.detect(v, 100);
  p.detect(v, 200);
  v.currentTime = 2;
  p.detect(v, 120);
  p.detect(v, 200);
  expect(f.model.detectForVideo).toHaveBeenCalledTimes(2);
  p.close();
});
it("reports model failures without claiming a ready pose detector", async () => {
  f.create.mockRejectedValue(Error("model unavailable"));
  const p = new BodyPose();
  await expect(p.init()).rejects.toThrow("model unavailable");
  expect(p.model).toBeUndefined();
  expect(p.error).toContain("model unavailable");
});
