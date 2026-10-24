import type { Edge } from "../performance/frame";
import type { LayerSettings } from "../drone/settings";
import type { MusicMode } from "../music/modes";
export type LoopEvent = {
  beat: number;
  edge: Edge;
  segment: number;
  velocity: number;
  genre: MusicMode | "drone";
  sound: string;
  kind: "HIT" | "ON" | "OFF";
  duration: number;
  settings?: LayerSettings;
};
export type LoopState = "STOPPED" | "RECORDING" | "PLAYING" | "OVERDUB";
export class EventLooper {
  events: LoopEvent[] = [];
  state: LoopState = "STOPPED";
  bars = 4;
  origin = 0;
  private last = -Infinity;
  private cycle = -1;
  constructor(
    private emit: (event: LoopEvent, beat: number) => void,
    private release: () => void,
    private recorded = () => {},
  ) {}
  get length() {
    return this.bars * 4;
  }
  setBars(bars: number) {
    if (![1, 2, 4, 8, 16, 32].includes(bars)) return;
    this.stop();
    this.bars = bars;
    this.events = this.events.filter((e) => e.beat < this.length);
  }
  record(beat: number) {
    this.stop();
    this.events = [];
    this.origin = beat;
    this.last = beat - 1e-6;
    this.cycle = 0;
    this.state = "RECORDING";
  }
  play(beat: number) {
    this.release();
    this.origin = beat;
    this.last = beat - 1e-6;
    this.cycle = -1;
    this.state = "PLAYING";
  }
  overdub(beat: number) {
    if (this.state === "STOPPED") this.play(beat);
    if (this.state === "RECORDING") return;
    this.state = this.state === "OVERDUB" ? "PLAYING" : "OVERDUB";
  }
  stop() {
    this.state = "STOPPED";
    this.release();
    this.last = -Infinity;
    this.cycle = -1;
  }
  clear() {
    this.stop();
    this.events = [];
  }
  capture(
    event: Omit<LoopEvent, "beat">,
    beat: number,
    source: "live" | "loop" = "live",
  ) {
    if (
      source !== "live" ||
      !["RECORDING", "OVERDUB"].includes(this.state) ||
      this.events.length >= 4096
    )
      return;
    const offset =
      (Math.round(
        ((((beat - this.origin) % this.length) + this.length) % this.length) *
          16,
      ) /
        16) %
      this.length;
    // Close the preceding sustained event, including an overdub that crosses the boundary.
    if (event.kind === "OFF") {
      const on = [...this.events]
        .reverse()
        .find(
          (e) =>
            e.kind === "ON" &&
            e.edge === event.edge &&
            e.segment === event.segment,
        );
      if (on)
        on.duration =
          (offset - on.beat + this.length) % this.length || this.length;
    }
    this.events.push(structuredClone({ ...event, beat: offset }));
  }
  tick(beat: number) {
    if (this.state === "STOPPED" || beat < this.last) return;
    if (this.state === "RECORDING") {
      if (beat >= this.origin + this.length) {
        this.state = "PLAYING";
        this.recorded();
        this.last = this.origin + this.length - 1e-6;
        this.cycle = -1;
      } else {
        this.last = beat;
        return;
      }
    }
    // Do not burst stale events after a suspended tab or a clock jump.
    if (beat - this.last > 1) {
      this.release();
      this.last = beat - 1 / 64;
      this.cycle = -1;
    }
    const cycle = Math.floor((beat - this.origin) / this.length),
      base = this.origin + cycle * this.length;
    const due: { event: LoopEvent; at: number }[] = [];
    // Restore notes spanning the boundary when playback is first entered. Later cycles
    // keep their gates, rather than toggling/retriggering a sustained voice at bar one.
    if (this.cycle === -1)
      for (const e of this.events)
        if (
          e.kind === "ON" &&
          e.beat + e.duration > this.length &&
          base + e.beat - this.length + e.duration > beat
        )
          due.push({ event: e, at: beat });
    this.cycle = cycle;
    const offKeys = new Set(
      this.events
        .filter((e) => e.kind === "OFF")
        .map((e) => `${e.edge}:${e.segment}:${Math.round(e.beat * 16)}`),
    );
    for (const e of this.events) {
      const at = base + e.beat;
      if (at > this.last + 1e-9 && at <= beat + 1e-9)
        due.push({ event: e, at });
      if (e.kind === "ON" && e.duration > 0)
        for (const origin of [at, at - this.length]) {
          const off = origin + e.duration;
          const explicit = offKeys.has(
            `${e.edge}:${e.segment}:${Math.round(((e.beat + e.duration) % this.length) * 16)}`,
          );
          if (!explicit && off > this.last + 1e-9 && off <= beat + 1e-9)
            due.push({ event: { ...e, kind: "OFF" }, at: off });
        }
    }
    due.sort(
      (a, b) =>
        a.at - b.at ||
        (a.event.kind === "OFF" ? -1 : b.event.kind === "OFF" ? 1 : 0),
    );
    for (const item of due) this.emit(item.event, item.at);
    this.last = beat;
  }
}
export const equalPower = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)] as const;
};
