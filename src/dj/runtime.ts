import * as Tone from "tone";
import { MusicEngine } from "../music/engine";
import type { MusicMode } from "../music/modes";
import { DroneEngine } from "../drone/engine";
import { defaults } from "../drone/settings";
import type { Edge } from "../performance/frame";
import { EventLooper, equalPower, type LoopEvent } from "./looper";
import { LabVoice } from "../sound-lab/audio";
import { presets } from "../sound-lab/presets";
export type Genre = MusicMode | "drone";
export class Deck {
  genre: Genre = "band";
  segments = 4;
  volume = 0.75;
  muted = false;
  sound = "genre";
  effect = 0.08;
  accompaniment = false;
  onEvent?: (event: LoopEvent) => void;
  readonly gain: Tone.Gain;
  readonly drone: DroneEngine;
  readonly loop: EventLooper;
  private input = new Tone.Gain(1);
  private fx = new Tone.Freeverb({ roomSize: 0.6, wet: 0.08 });
  private playbackBeat = 0;
  private playbackTime = 0;
  private engines = new Map<MusicMode, MusicEngine>();
  private sounds = new Map<string, LabVoice>();
  private enabled = false;
  private generation = 0;
  private live = new Set<string>();
  private replay = new Set<string>();
  constructor(output: Tone.InputNode) {
    this.gain = new Tone.Gain(0.75).connect(output);
    this.fx.connect(this.gain);
    this.input.connect(this.fx);
    this.drone = new DroneEngine(defaults(), {
      output: this.input,
      sharedClock: true,
    });
    this.drone.setSegments(this.segments);
    this.loop = new EventLooper(
      (event, beat) =>
        this.playEvent(
          event,
          this.playbackTime +
            ((beat - this.playbackBeat) * 60) / Tone.getTransport().bpm.value,
        ),
      () => this.releaseReplay(),
      () => {
        this.live.clear();
        this.drone.panic();
      },
    );
  }
  private engine(mode: MusicMode) {
    let m = this.engines.get(mode);
    if (!m) {
      m = new MusicEngine({ output: this.input, sharedClock: true });
      m.setAccompaniment(this.accompaniment && mode === this.genre);
      m.setMode(mode);
      m.quantize = null;
      this.engines.set(mode, m);
      if (this.enabled) void m.setEnabled(true);
    }
    return m;
  }
  get beat() {
    const t = Tone.getTransport();
    return t.ticks / t.PPQ;
  }
  async enable(on: boolean) {
    const generation = ++this.generation;
    this.enabled = on;
    if (on) {
      this.input.disconnect();
      this.fx.dispose();
      this.fx = new Tone.Freeverb({ roomSize: 0.6, wet: this.effect }).connect(
        this.gain,
      );
      this.input.connect(this.fx);
    }
    if (!on) {
      this.loop.stop();
      this.live.clear();
      this.replay.clear();
      for (const m of this.engines.values()) m.dispose();
      this.engines.clear();
      for (const voice of this.sounds.values()) voice.dispose();
      this.sounds.clear();
      await this.drone.setEnabled(false);
      if (generation !== this.generation) return;
      this.mix(1);
      return;
    }
    if (this.genre !== "drone") this.engine(this.genre);
    for (const e of this.loop.events)
      if (e.genre !== "drone") this.engine(e.genre);
    await Promise.all([
      this.drone.setEnabled(on),
      ...[...this.engines.values()].map((m) => m.setEnabled(on)),
    ]);
    if (generation !== this.generation) return;
    this.mix(1);
  }
  setAccompaniment(on: boolean) {
    this.accompaniment = on;
    for (const [mode, m] of this.engines)
      m.setAccompaniment(on && mode === this.genre);
  }
  setGenre(genre: Genre) {
    if (this.genre !== genre) {
      const held = [...this.live];
      this.live.clear();
      held.forEach((key) => this.gate(key));
      if (this.genre !== "drone") this.engines.get(this.genre)?.stopVoices();
    }
    this.genre = genre;
    this.setAccompaniment(this.accompaniment);
    if (genre !== "drone") this.engine(genre);
  }
  setSegments(n: number) {
    this.loop.stop();
    this.live.clear();
    this.replay.clear();
    this.segments = Math.max(1, Math.min(8, Math.round(n)));
    this.drone.setSegments(this.segments);
    this.loop.events = this.loop.events.filter(
      (e) => e.segment < this.segments,
    );
  }
  tick(beat: number, time: number) {
    this.playbackBeat = beat;
    this.playbackTime = time;
    this.loop.tick(beat);
  }
  mix(value: number) {
    this.fx.wet.rampTo(this.effect, 0.05);
    this.gain.gain.rampTo(
      this.enabled && !this.muted ? this.volume * value : 0,
      0.035,
    );
  }
  private gate(key: string, time?: number) {
    const [edge, index] = key.split(":");
    this.drone.setGate(
      edge as Edge,
      +index,
      this.live.has(key) || this.replay.has(key),
      time,
    );
  }
  hit(edge: Edge, segment: number, velocity = 0.7) {
    if (!this.enabled || segment >= this.segments) return;
    const key = `${edge}:${segment}`;
    let kind: LoopEvent["kind"] = "HIT";
    if (this.genre === "drone") {
      if (this.drone.phase(edge, segment) === "OFF") this.live.delete(key);
      if (this.live.has(key)) {
        this.live.delete(key);
        kind = "OFF";
      } else {
        this.live.add(key);
        kind = "ON";
      }
      this.gate(key);
    }
    const settings =
      this.genre === "drone"
        ? structuredClone(this.drone.segmentSettings(segment).layers[edge])
        : undefined;
    const event: Omit<LoopEvent, "beat"> = {
      edge,
      segment,
      velocity,
      genre: this.genre,
      sound: this.sound,
      kind,
      duration:
        settings?.mode === "TIMED" ? settings.duration : this.loop.length,
      settings,
    };
    if (kind === "HIT") this.playEvent({ ...event, beat: 0 });
    this.loop.capture(event, this.beat);
  }
  private playEvent(e: LoopEvent, time?: number) {
    if (!this.enabled || e.segment >= this.segments) return;
    this.onEvent?.(e);
    if (e.genre === "drone") {
      const key = `${e.edge}:${e.segment}`;
      if (e.settings) this.drone.configureCell(e.edge, e.segment, e.settings);
      if (e.kind === "ON") this.replay.add(key);
      else this.replay.delete(key);
      this.gate(key, time);
      return;
    }
    const m = this.engine(e.genre);
    const preset = presets.find((p) => p.id === e.sound);
    if (preset) {
      let voice = this.sounds.get(e.sound);
      if (!voice) {
        voice = new LabVoice(preset, this.input);
        this.sounds.set(e.sound, voice);
      }
      voice.hit(
        Tone.Frequency(m.note(e.segment)).toMidi(),
        0.3,
        time ?? Tone.now(),
        Math.min(1, e.velocity + 0.22),
      );
      return;
    }
    m.setContinuous("right", this.effect, 0.5);
    m.handleEdge(
      { edge: e.edge, zone: e.segment, velocity: e.velocity, direction: "in" },
      time,
    );
  }
  private releaseReplay() {
    const keys = [...this.replay];
    this.replay.clear();
    keys.forEach((key) => this.gate(key));
    for (const m of this.engines.values()) m.stopVoices();
    for (const voice of this.sounds.values()) voice.stop();
  }
  panic() {
    this.loop.stop();
    this.live.clear();
    this.replay.clear();
    this.drone.panic();
    for (const m of this.engines.values()) m.stopVoices();
    for (const voice of this.sounds.values()) voice.stop();
  }
  dispose() {
    this.generation++;
    this.enabled = false;
    this.panic();
    this.drone.dispose();
    for (const m of this.engines.values()) m.dispose();
    for (const voice of this.sounds.values()) voice.dispose();
    this.sounds.clear();
    this.input.dispose();
    this.fx.dispose();
    this.gain.dispose();
  }
}
export class DJAudio {
  private limiter = new Tone.Limiter(-3).toDestination();
  private master = new Tone.Gain(0.7).connect(this.limiter);
  readonly A = new Deck(this.master);
  readonly B = new Deck(this.master);
  bpm = 100;
  volume = 0.7;
  fade = 0.5;
  enabled = false;
  private schedule?: number;
  private generation = 0;
  setMix() {
    const [a, b] = equalPower(this.fade);
    this.A.mix(a);
    this.B.mix(b);
    this.master.gain.rampTo(this.enabled ? this.volume : 0, 0.03);
  }
  setTempo(bpm: number) {
    this.bpm = Math.max(40, Math.min(180, bpm));
    const t = Tone.getTransport();
    t.bpm.cancelScheduledValues(0);
    t.bpm.value = this.bpm;
    for (const deck of [this.A, this.B])
      deck.drone.configure({ ...deck.drone.settings, bpm: this.bpm });
  }
  async enable(on: boolean) {
    const gen = ++this.generation;
    this.enabled = false;
    if (!on) {
      if (this.schedule !== undefined) Tone.getTransport().clear(this.schedule);
      this.schedule = undefined;
      this.setMix();
    }
    await Promise.all([this.A.enable(on), this.B.enable(on)]);
    if (gen !== this.generation) return;
    this.enabled = on;
    if (on) {
      this.setTempo(this.bpm);
      const t = Tone.getTransport();
      if (this.schedule === undefined)
        this.schedule = t.scheduleRepeat((time) => {
          const beat = t.getTicksAtTime(time) / t.PPQ;
          this.A.tick(beat, time);
          this.B.tick(beat, time);
        }, "64n");
      t.start();
    }
    this.setMix();
  }
  panic() {
    this.A.panic();
    this.B.panic();
    void this.enable(false);
  }
  dispose() {
    this.generation++;
    if (this.schedule !== undefined) Tone.getTransport().clear(this.schedule);
    this.A.dispose();
    this.B.dispose();
    this.master.dispose();
    this.limiter.dispose();
  }
}
