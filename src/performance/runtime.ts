export type TrackingEngine = "hands" | "body";
export type Preset = "quality" | "balanced" | "light";
export const PRESETS = {
  quality: {
    width: 1280,
    height: 720,
    handsFps: 30,
    poseFps: 15,
    renderFps: 60,
  },
  balanced: {
    width: 960,
    height: 540,
    handsFps: 20,
    poseFps: 10,
    renderFps: 60,
  },
  light: { width: 640, height: 360, handsFps: 12, poseFps: 6, renderFps: 30 },
} as const;
export type PerformanceSettings = { engine: TrackingEngine; preset: Preset };
const KEY = "finger-symphony-performance-v1";
export function loadPerformance(
  storage: Pick<Storage, "getItem"> = localStorage,
): PerformanceSettings {
  const result: PerformanceSettings = { engine: "hands", preset: "balanced" };
  try {
    const v = JSON.parse(storage.getItem(KEY) || "{}");
    if (v.engine === "hands" || v.engine === "body") result.engine = v.engine;
    if (Object.hasOwn(PRESETS, v.preset)) result.preset = v.preset;
  } catch {}
  return result;
}
export function savePerformance(
  settings: PerformanceSettings,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {}
}
export function cameraConstraints(preset: Preset): MediaTrackConstraints {
  const p = PRESETS[preset];
  return { width: { ideal: p.width }, height: { ideal: p.height } };
}
/** Drops missed frames; never accumulates a backlog. One model call per animation turn. */
export class InferenceBudget {
  private at = { hands: -Infinity, pose: -Infinity };
  private video = { hands: -1, pose: -1 };
  private last: "hands" | "pose" = "pose";
  private busy = false;
  reset() {
    this.at = { hands: -Infinity, pose: -Infinity };
    this.video = { hands: -1, pose: -1 };
  }
  run<T>(
    time: number,
    videoTime: number,
    preset: Preset,
    ready: { hands: boolean; pose: boolean },
    call: (kind: "hands" | "pose") => T,
  ): T | undefined {
    if (this.busy) return;
    const p = PRESETS[preset],
      order: ("hands" | "pose")[] =
        this.last === "hands" ? ["pose", "hands"] : ["hands", "pose"];
    const kind = order.find(
      (k) =>
        ready[k] &&
        videoTime !== this.video[k] &&
        time - this.at[k] >=
          1000 / (k === "hands" ? p.handsFps : p.poseFps) - 0.5,
    );
    if (!kind) return;
    this.busy = true;
    this.last = kind;
    this.at[kind] = time;
    this.video[kind] = videoTime;
    try {
      return call(kind);
    } finally {
      this.busy = false;
    }
  }
}
type Model = { init: () => Promise<void>; close: () => void };
/** Serialized initialization plus immediate invalidation/release on engine changes. */
export class TrackingLifecycle {
  private generation = 0;
  private pending: Promise<void> = Promise.resolve();
  state: "INACTIVE" | "STARTING" | "ON" | "ERROR" = "INACTIVE";
  error = "";
  constructor(
    private hands: Model,
    private pose: Model,
  ) {}
  start(engine: TrackingEngine) {
    this.stop();
    const generation = this.generation;
    this.state = "STARTING";
    this.error = "";
    this.pending = this.pending
      .catch(() => {})
      .then(async () => {
        if (generation !== this.generation) return;
        try {
          await this.hands.init();
          if (generation !== this.generation) return;
          if (engine === "body") await this.pose.init();
          if (generation === this.generation) this.state = "ON";
        } catch (e) {
          if (generation === this.generation) {
            this.state = "ERROR";
            this.error = String(e);
            throw e;
          }
        }
      });
    return this.pending;
  }
  stop() {
    this.generation++;
    this.hands.close();
    this.pose.close();
    this.state = "INACTIVE";
  }
}
export class PerformanceMeter {
  private start: number;
  private counts = { render: 0, hands: 0, pose: 0 };
  private sums = { hands: 0, pose: 0 };
  private previous?: number;
  longFrames = 0;
  errors = 0;
  recoveries = 0;
  constructor(now = performance.now()) {
    this.start = now;
  }
  frame(t: number) {
    if (this.previous !== undefined && t - this.previous > 50)
      this.longFrames++;
    this.previous = t;
  }
  render() {
    this.counts.render++;
  }
  inference(kind: "hands" | "pose", ms: number) {
    this.counts[kind]++;
    this.sums[kind] += ms;
  }
  sample(t: number) {
    const seconds = Math.max(0.001, (t - this.start) / 1000),
      c = this.counts,
      s = this.sums;
    this.start = t;
    this.counts = { render: 0, hands: 0, pose: 0 };
    this.sums = { hands: 0, pose: 0 };
    return {
      renderFps: c.render / seconds,
      handsFps: c.hands / seconds,
      poseFps: c.pose / seconds,
      handsMs: c.hands ? s.hands / c.hands : null,
      poseMs: c.pose ? s.pose / c.pose : null,
      totalMs: s.hands + s.pose,
      windowMs: seconds * 1000,
    };
  }
}
export const activeMetric = (
  active: boolean,
  value: number | null,
  suffix = "",
) =>
  !active ? "INACTIVE" : value === null ? "N/A" : value.toFixed(1) + suffix;
