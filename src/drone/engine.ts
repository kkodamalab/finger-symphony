import * as Tone from "tone";
import type { Edge } from "../performance/frame";
import { EDGES, type Settings, type LayerSettings, validate } from "./settings";
import { LayerState } from "./state";
import {
  BassDroneLayer,
  ArpeggioLayer,
  FieldRecordingLayer,
  PercussionLayer,
  type Layer,
} from "./layers";
type Cell = {
  state: LayerState;
  gain: Tone.Gain;
  layer: Layer;
  origin: number;
  running: boolean;
};
export class DroneEngine {
  settings: Settings;
  segments = 1;
  selected = 0;
  private banks: Settings[];
  private cells = new Map<string, Cell>();
  private meter = new Tone.Meter({ normalRange: true, smoothing: 0.7 });
  private limiter = new Tone.Limiter(-3);
  private master = new Tone.Gain(0).connect(this.limiter);
  private scheduled?: number;
  private enabled = false;
  private disposed = false;
  private generation = 0;
  private lastStep = -1;
  constructor(
    settings: Settings,
    private options: { output?: Tone.InputNode; sharedClock?: boolean } = {},
  ) {
    this.settings = validate(settings);
    this.banks = [this.settings];
    if (options.output) this.limiter.connect(options.output);
    else this.limiter.toDestination();
    this.master.connect(this.meter);
    EDGES.forEach((e) => this.cell(e, 0));
    this.configure(this.settings);
  }
  get states() {
    return Object.fromEntries(
      EDGES.map((e) => [e, this.cell(e, this.selected).state]),
    ) as Record<Edge, LayerState>;
  }
  get beat() {
    const t = Tone.getTransport();
    return t.ticks / t.PPQ;
  }
  get diagnostics() {
    const value = this.meter.getValue(),
      field = this.cells.get(`0:left`)?.layer as
        | FieldRecordingLayer
        | undefined;
    return {
      peak: Array.isArray(value) ? Math.max(...value) : value,
      enabled: this.enabled,
      schedules: this.scheduled === undefined ? 0 : 1,
      active: [...this.cells.values()].filter((c) => c.running).length,
      field: field?.source ?? "SYNTH",
      sample: field?.sampleStatus ?? "",
    };
  }
  private cell(edge: Edge, index: number) {
    const key = `${index}:${edge}`;
    let cell = this.cells.get(key);
    if (!cell) {
      const gain = new Tone.Gain(0).connect(this.master);
      const layer =
        edge === "bottom"
          ? new BassDroneLayer(gain)
          : edge === "top"
            ? new ArpeggioLayer(gain)
            : edge === "left"
              ? new FieldRecordingLayer(gain)
              : new PercussionLayer(gain);
      cell = {
        state: new LayerState(),
        gain,
        layer,
        origin: 0,
        running: false,
      };
      this.cells.set(key, cell);
      layer.configure(this.banks[index].layers[edge], this.banks[index]);
    }
    return cell;
  }
  segmentSettings(index: number) {
    return this.banks[index];
  }
  phase(edge: Edge, index: number) {
    return this.cells.get(`${index}:${edge}`)?.state.phase ?? "OFF";
  }
  select(index: number) {
    this.selected = Math.max(0, Math.min(this.segments - 1, index));
    this.settings = this.banks[this.selected];
  }
  setSegments(count: number) {
    count = Math.max(1, Math.min(8, Math.round(count)));
    if (count === this.segments) return;
    this.panic();
    for (const [key, cell] of this.cells)
      if (Number(key.split(":")[0]) >= count) {
        cell.layer.dispose();
        cell.gain.dispose();
        this.cells.delete(key);
      }
    while (this.banks.length < count) this.banks.push(validate(this.banks[0]));
    this.segments = count;
    this.select(Math.min(this.selected, count - 1));
  }
  snapshot() {
    return {
      version: 2,
      segments: this.segments,
      banks: this.banks.map((s) => validate(s)),
    };
  }
  restore(value: unknown) {
    const v = value as { version: number; segments: number; banks: unknown[] };
    if (
      v?.version !== 2 ||
      !Number.isInteger(v.segments) ||
      v.segments < 1 ||
      v.segments > 8 ||
      !Array.isArray(v.banks) ||
      v.banks.length < v.segments ||
      v.banks.length > 8
    )
      throw Error("DRONE segments v2 JSON required");
    const banks = v.banks.map(validate);
    this.panic();
    this.setSegments(v.segments);
    this.banks = banks;
    this.select(0);
    this.configure(this.settings);
  }
  configure(settings: Settings) {
    this.settings = validate(settings);
    this.banks[this.selected] = this.settings;
    for (const s of this.banks) {
      s.bpm = this.settings.bpm;
      s.master = this.settings.master;
    }
    if (this.enabled) {
      if (!this.options.sharedClock)
        Tone.getTransport().bpm.value = this.settings.bpm;
      this.master.gain.rampTo(this.settings.master, 0.08);
    }
    for (const [key, cell] of this.cells) {
      const [i, e] = key.split(":");
      cell.layer.configure(this.banks[+i].layers[e as Edge], this.banks[+i]);
    }
  }
  configureCell(edge: Edge, index: number, settings: LayerSettings) {
    const bank = validate({
      ...this.banks[index],
      layers: { ...this.banks[index].layers, [edge]: settings },
    });
    this.banks[index] = bank;
    if (index === this.selected) this.settings = bank;
    this.cells
      .get(`${index}:${edge}`)
      ?.layer.configure(bank.layers[edge], bank);
  }
  async setEnabled(on: boolean) {
    const gen = ++this.generation;
    if (this.disposed) return;
    if (!on) {
      this.enabled = false;
      this.lastStep = -1;
      this.panic();
      if (this.scheduled !== undefined)
        Tone.getTransport().clear(this.scheduled);
      this.scheduled = undefined;
      this.master.gain.cancelScheduledValues(0);
      this.master.gain.value = 0;
      return;
    }
    await Tone.start();
    if (this.disposed || gen !== this.generation) return;
    this.enabled = true;
    this.configure(this.settings);
    const transport = Tone.getTransport();
    if (this.scheduled === undefined)
      this.scheduled = transport.scheduleRepeat(
        (time) => this.tick(time),
        "64n",
      );
    transport.start();
  }
  toggle(edge: Edge, index = this.selected, time = Tone.now()) {
    if (!this.enabled || this.disposed || index < 0 || index >= this.segments)
      return;
    const cell = this.cell(edge, index),
      s = this.banks[index].layers[edge];
    if (
      cell.state.phase === "FADE" &&
      s.retrigger === "RESTART" &&
      cell.running
    ) {
      cell.layer.stop(time);
      cell.running = false;
    }
    cell.state.toggle(this.beat, s);
    this.sync(edge, index, cell, time, this.beat);
  }
  setGate(edge: Edge, index: number, on: boolean, time = Tone.now()) {
    if (!this.enabled || index >= this.segments) return;
    const c = this.cell(edge, index),
      s = this.banks[index].layers[edge];
    if (on) {
      if (c.state.phase !== "ON") c.state.start(this.beat);
    } else c.state.stop(this.beat, s);
    this.sync(edge, index, c, time, this.beat);
  }
  allOff() {
    for (const [key, c] of this.cells) {
      const [i, e] = key.split(":");
      c.state.stop(this.beat, this.banks[+i].layers[e as Edge]);
    }
  }
  panic() {
    for (const c of this.cells.values()) {
      c.state.panic();
      c.gain.gain.cancelScheduledValues(0);
      c.gain.gain.setValueAtTime(0, Tone.immediate());
      if (c.running) c.layer.stop(Tone.now());
      c.running = false;
    }
  }
  private sync(e: Edge, i: number, c: Cell, time: number, beat: number) {
    const s = this.banks[i].layers[e];
    if (c.layer.finished?.()) c.state.panic();
    c.state.update(beat, s);
    if (c.state.phase === "OFF") {
      if (c.running) c.layer.stop(time);
      c.running = false;
    } else if (!c.running) {
      c.origin = Math.ceil(beat * 4 - 1e-5);
      c.layer.start(time);
      c.running = true;
    }
    c.gain.gain.rampTo(c.state.level(beat, s) * s.volume, 0.015, time);
  }
  private tick(time: number) {
    if (!this.enabled) return;
    const t = Tone.getTransport(),
      beat = t.getTicksAtTime(time) / t.PPQ,
      step = Math.floor(beat * 4 + 1e-5);
    for (const [key, c] of this.cells) {
      const [i, e] = key.split(":");
      this.sync(e as Edge, +i, c, time, beat);
      if (step !== this.lastStep && c.state.phase !== "OFF" && step >= c.origin)
        c.layer.tick(step - c.origin, time);
    }
    this.lastStep = step;
  }
  dispose() {
    if (this.disposed) return;
    void this.setEnabled(false);
    this.disposed = true;
    for (const c of this.cells.values()) {
      c.layer.dispose();
      c.gain.dispose();
    }
    [this.master, this.limiter, this.meter].forEach((n) => n.dispose());
  }
}
