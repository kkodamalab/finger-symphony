import { DJAudio, type Genre } from "./runtime";
import { BodyGestures } from "./gestures";
import type { Hand } from "../tracking/hands";
import {
  edges,
  type BodyContactEvent,
  type ContactTarget,
} from "../body/contact";
import { modeNames } from "../music/modes";
import { PRESETS, preset, type LayerSettings } from "../drone/settings";
import { presets } from "../sound-lab/presets";
import "./dj.css";
export function mountDJ(stage: HTMLElement, onMode: (on: boolean) => void) {
  const audio = new DJAudio(),
    gestures = new BodyGestures();
  let active = false;
  const selected = {
    A: { edge: "bottom" as (typeof edges)[number], index: 0 },
    B: { edge: "bottom" as (typeof edges)[number], index: 0 },
  };
  const targets: ContactTarget[] = [
    {
      deckId: "A",
      frame: { x: 0.07, y: 0.17, width: 0.38, height: 0.58 },
      segments: 4,
    },
    {
      deckId: "B",
      frame: { x: 0.55, y: 0.17, width: 0.38, height: 0.58 },
      segments: 4,
    },
  ];
  const switcher = document.createElement("nav");
  switcher.id = "performance-mode";
  switcher.innerHTML =
    '<button data-layout="solo" aria-pressed="true">SOLO</button><button data-layout="mix" aria-pressed="false">DJ MIX</button><span>BODY CONTACT · 推定された身体のどの部位でも演奏</span>';
  document.querySelector("#modes")!.before(switcher);
  const panel = document.createElement("section");
  panel.id = "dj-panel";
  panel.hidden = true;
  stage.after(panel);
  const overlay = document.createElement("div");
  overlay.id = "dj-overlay";
  overlay.hidden = true;
  stage.append(overlay);
  const opts = (values: string[], value: string) =>
    values
      .map(
        (v) =>
          `<option value="${v}" ${v === value ? "selected" : ""}>${v.toUpperCase()}</option>`,
      )
      .join("");
  function save() {
    try {
      localStorage.setItem(
        "finger-symphony-dj-v1",
        JSON.stringify({
          bpm: audio.bpm,
          volume: audio.volume,
          fade: audio.fade,
          A: snapshot("A"),
          B: snapshot("B"),
        }),
      );
    } catch {}
  }
  function snapshot(id: "A" | "B") {
    const d = audio[id];
    return {
      genre: d.genre,
      segments: d.segments,
      volume: d.volume,
      muted: d.muted,
      sound: d.sound,
      effect: d.effect,
      accompaniment: d.accompaniment,
      drone: d.drone.snapshot(),
      bars: d.loop.bars,
    };
  }
  try {
    const v = JSON.parse(
      localStorage.getItem("finger-symphony-dj-v1") ?? "null",
    );
    if (v) {
      for (const id of ["A", "B"] as const) {
        const s = v[id],
          d = audio[id];
        if (!s) continue;
        if ([...modeNames, "drone"].includes(s.genre)) d.setGenre(s.genre);
        if (Number.isInteger(s.segments) && s.segments >= 1 && s.segments <= 8)
          d.setSegments(s.segments);
        if (Number.isFinite(s.volume))
          d.volume = Math.max(0, Math.min(1, s.volume));
        d.muted = s.muted === true;
        d.setAccompaniment(s.accompaniment === true);
        if (presets.some((p) => p.id === s.sound)) d.sound = s.sound;
        if (Number.isFinite(s.effect))
          d.effect = Math.max(0, Math.min(1, s.effect));
        if (s.drone) d.drone.restore(s.drone);
        d.drone.setSegments(d.segments);
        d.loop.setBars(s.bars);
      }
      if (Number.isFinite(v.bpm))
        audio.bpm = Math.max(40, Math.min(180, v.bpm));
      if (Number.isFinite(v.volume))
        audio.volume = Math.max(0, Math.min(1, v.volume));
      if (Number.isFinite(v.fade))
        audio.fade = Math.max(0, Math.min(1, v.fade));
    }
  } catch {}
  function frames() {
    overlay.innerHTML =
      targets
        .map((t) => {
          const d = audio[t.deckId as "A" | "B"];
          t.segments = d.segments;
          return `<div class="dj-frame" data-deck="${t.deckId}" style="left:${t.frame.x * 100}%;top:${t.frame.y * 100}%;width:${t.frame.width * 100}%;height:${t.frame.height * 100}%"><b>DECK ${t.deckId} · ${d.genre.toUpperCase()}</b>${edges.map((e) => `<div class="edge ${e}">${Array.from({ length: d.segments }, (_, i) => `<button data-edge="${e}" data-index="${i}" aria-label="Deck ${t.deckId} ${e} segment ${i + 1}">${i + 1}</button>`).join("")}</div>`).join("")}</div>`;
        })
        .join("") +
      '<div class="gesture-strip">BODY CONTROL AREA · 左: DECK A / 右: DECK B · PINCH → FADER</div>';
    overlay.querySelectorAll<HTMLButtonElement>("[data-edge]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.closest<HTMLElement>("[data-deck]")!.dataset.deck as
            | "A"
            | "B";
          audio[id].hit(
            b.dataset.edge as (typeof edges)[number],
            +b.dataset.index!,
          );
          feedback(id, b.dataset.edge!, +b.dataset.index!);
          selected[id] = {
            edge: b.dataset.edge as (typeof edges)[number],
            index: +b.dataset.index!,
          };
          editor(id);
        }),
    );
  }
  function editor(id: "A" | "B") {
    const d = audio[id],
      s = selected[id];
    s.index = Math.min(s.index, d.segments - 1);
    const l = d.drone.segmentSettings(s.index).layers[s.edge],
      host = panel.querySelector(`[data-editor="${id}"]`)!;
    host.innerHTML = `<summary>DRONE · ${s.edge.toUpperCase()} ${s.index + 1} — SEGMENT SETTINGS</summary><div class="dj-fields"><label>EDGE<select data-edit-edge>${opts(edges, s.edge)}</select></label><label>SEGMENT<select data-edit-index>${Array.from({ length: d.segments }, (_, i) => `<option value="${i}" ${i === s.index ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label><label>TONE<select data-cell="preset">${opts(PRESETS[s.edge], l.preset)}</select></label>${(["octave", "transpose", "volume", "duration", "fadeIn", "fadeOut"] as const).map((k) => `<label>${k.toUpperCase()}<input data-cell="${k}" type="number" value="${l[k]}" min="${k === "transpose" ? -24 : k === "duration" ? 1 : 0}" max="${k === "transpose" ? 24 : k === "octave" ? 6 : k === "volume" ? 1 : k === "duration" ? 128 : 32}" step="${k === "volume" ? 0.05 : 1}"></label>`).join("")}<label>SUSTAIN<select data-cell="mode">${opts(["INFINITE", "TIMED"], l.mode)}</select></label></div>`;
    host.querySelector<HTMLSelectElement>("[data-edit-edge]")!.onchange = (
      e,
    ) => {
      s.edge = (e.target as HTMLSelectElement).value as typeof s.edge;
      editor(id);
    };
    host.querySelector<HTMLSelectElement>("[data-edit-index]")!.onchange = (
      e,
    ) => {
      s.index = +(e.target as HTMLSelectElement).value;
      editor(id);
    };
    host
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-cell]")
      .forEach(
        (el) =>
          (el.onchange = () => {
            const next = structuredClone(l),
              key = el.dataset.cell!;
            if (key === "preset") preset(next, s.edge, el.value);
            else
              (next as unknown as Record<string, unknown>)[key] =
                el.type === "number" ? Number(el.value) : el.value;
            d.drone.configureCell(s.edge, s.index, next as LayerSettings);
            save();
          }),
      );
  }
  function render() {
    panel.innerHTML = `<div class="dj-global"><button id="dj-audio">AUDIO ON</button><label>COMMON BPM<input id="dj-bpm" type="number" min="40" max="180" value="${audio.bpm}"></label><label>MASTER VOLUME<input id="dj-master" type="range" min="0" max="1" step=".01" value="${audio.volume}"></label><button id="dj-panic">PANIC STOP</button><label>GESTURES<input id="dj-gestures" type="checkbox" ${gestures.enabled ? "checked" : ""}></label><label>HOLD (ms)<input id="dj-hold" type="number" min="500" max="3000" step="100" value="${gestures.holdMs}"></label><output id="dj-gesture-status" role="status"></output></div><label class="crossfader">DECK A ← EQUAL POWER → DECK B<input id="dj-fade" type="range" min="0" max="1" step=".01" value="${audio.fade}"></label><div class="dj-decks">${(
      ["A", "B"] as const
    )
      .map((id) => {
        const d = audio[id];
        return `<article data-deck="${id}"><h2>DECK ${id}</h2><div class="dj-fields"><label>GENRE<select data-setting="genre">${opts([...modeNames, "drone"], d.genre)}</select></label><label>SEGMENTS<select data-setting="segments">${opts(["1", "2", "3", "4", "5", "6", "7", "8"], String(d.segments))}</select></label><label>HIT / MELODY TONE<select data-setting="sound"><option value="genre">GENRE ORIGINAL</option>${presets.map((p) => `<option value="${p.id}" ${d.sound === p.id ? "selected" : ""}>${p.name}</option>`).join("")}</select></label><label>VOLUME<input data-setting="volume" type="range" min="0" max="1" step=".01" value="${d.volume}"></label><label>EFFECT<input data-setting="effect" type="range" min="0" max="1" step=".01" value="${d.effect}"></label><label>AUTO BACKING<input data-setting="accompaniment" type="checkbox" ${d.accompaniment ? "checked" : ""}></label><label>MUTE<input data-setting="muted" type="checkbox" ${d.muted ? "checked" : ""}></label><label>LOOP BARS<select data-setting="bars">${opts(["1", "2", "4", "8", "16", "32"], String(d.loop.bars))}</select></label></div><output data-loop-status>STOPPED</output><output data-hit-status>辺の番号をクリックしても演奏できます</output><div class="dj-buttons">${["REC", "PLAY", "STOP", "OVERDUB", "CLEAR"].map((action) => `<button data-action="${action}">${action}</button>`).join("")}</div><details data-editor="${id}"></details></article>`;
      })
      .join(
        "",
      )}</div><p>身体の左右ではなく、触れたフレームで演奏先が決まります。下部操作帯で OPEN → REC / FIST → PLAY・STOP / PEACE → OVERDUB。CLEARは確認後に消去。スマホは横画面推奨。</p>`;
    for (const id of ["A", "B"] as const) editor(id);
    panel
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")
      .forEach(
        (el) =>
          (el.onchange = () => {
            const id = el.closest<HTMLElement>("[data-deck]")!.dataset.deck as
                | "A"
                | "B",
              d = audio[id],
              key = el.dataset.setting!;
            if (key === "genre") d.setGenre(el.value as Genre);
            if (key === "segments") {
              d.setSegments(+el.value);
              editor(id);
            }
            if (key === "sound") d.sound = el.value;
            if (key === "accompaniment")
              d.setAccompaniment((el as HTMLInputElement).checked);
            if (key === "volume") d.volume = +el.value;
            if (key === "effect") d.effect = +el.value;
            if (key === "muted") d.muted = (el as HTMLInputElement).checked;
            if (key === "bars") d.loop.setBars(+el.value);
            audio.setMix();
            frames();
            save();
          }),
      );
    panel
      .querySelectorAll<HTMLButtonElement>("[data-action]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            command(
              b.closest<HTMLElement>("[data-deck]")!.dataset.deck as "A" | "B",
              b.dataset.action!,
            )),
      );
    panel.querySelector<HTMLInputElement>("#dj-fade")!.oninput = (e) =>
      fade(+(e.target as HTMLInputElement).value);
    panel.querySelector<HTMLInputElement>("#dj-bpm")!.onchange = (e) => {
      audio.setTempo(+(e.target as HTMLInputElement).value || 100);
      save();
    };
    panel.querySelector<HTMLInputElement>("#dj-master")!.oninput = (e) => {
      audio.volume = +(e.target as HTMLInputElement).value;
      audio.setMix();
      save();
    };
    panel.querySelector<HTMLInputElement>("#dj-gestures")!.onchange = (e) => {
      gestures.enabled = (e.target as HTMLInputElement).checked;
      gestures.reset();
    };
    panel.querySelector<HTMLInputElement>("#dj-hold")!.onchange = (e) =>
      (gestures.holdMs = Math.max(
        500,
        Math.min(3000, +(e.target as HTMLInputElement).value || 1000),
      ));
    panel.querySelector<HTMLButtonElement>("#dj-audio")!.onclick = () =>
      document.querySelector<HTMLButtonElement>("#audio")!.click();
    panel.querySelector<HTMLButtonElement>("#dj-panic")!.onclick = () => {
      audio.panic();
      document.querySelector("#audio-status")!.textContent = "AUDIO: OFF";
      document.querySelector<HTMLButtonElement>("#audio")!.textContent =
        "AUDIO ON";
    };
  }
  function command(id: "A" | "B", action: string) {
    const d = audio[id];
    if (action === "CLEAR") {
      if (confirm(`DECK ${id} のループを消去しますか？`)) d.loop.clear();
      return;
    }
    if (action === "STOP") {
      d.loop.stop();
      return;
    }
    if (!audio.enabled) {
      panel.querySelector("#dj-gesture-status")!.textContent =
        "先に AUDIO ON を押してください";
      return;
    }
    if (action === "REC") d.loop.record(d.beat);
    if (action === "PLAY") d.loop.play(d.beat);
    if (action === "OVERDUB") d.loop.overdub(d.beat);
    if (action === "PLAY_STOP") {
      if (d.loop.state === "STOPPED") d.loop.play(d.beat);
      else d.loop.stop();
    }
  }
  function fade(value: number) {
    audio.fade = value;
    audio.setMix();
    panel.querySelector<HTMLInputElement>("#dj-fade")!.value = String(value);
    save();
  }
  function feedback(id: string, edge: string, index: number) {
    const deck = audio[id as "A" | "B"];
    const voice =
      deck.genre === "drone"
        ? deck.drone.segmentSettings(index).layers[
            edge as (typeof edges)[number]
          ].preset
        : deck.sound === "genre"
          ? deck.genre
          : presets.find((p) => p.id === deck.sound)?.name;
    panel.querySelector(`[data-deck="${id}"] [data-hit-status]`)!.textContent =
      `${audio.enabled ? "HIT" : "AUDIO OFF"} · ${edge.toUpperCase()} ${index + 1} · ${voice}`;
    const b = overlay.querySelector(
      `[data-deck="${id}"] [data-edge="${edge}"][data-index="${index}"]`,
    );
    b?.classList.add("active");
    setTimeout(() => b?.classList.remove("active"), 180);
  }
  switcher.querySelectorAll<HTMLButtonElement>("button").forEach(
    (b) =>
      (b.onclick = () => {
        active = b.dataset.layout === "mix";
        void audio.enable(false);
        gestures.reset();
        document.body.classList.toggle("dj-mode", active);
        panel.hidden = !active;
        overlay.hidden = !active;
        switcher
          .querySelectorAll("button")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        onMode(active);
        frames();
      }),
  );
  render();
  for (const id of ["A", "B"] as const)
    audio[id].onEvent = (e) => feedback(id, e.edge, e.segment);
  frames();
  const timer = setInterval(() => {
    if (!active) return;
    panel.querySelector("#dj-audio")!.textContent = audio.enabled
      ? "AUDIO OFF"
      : "AUDIO ON";
    for (const id of ["A", "B"] as const) {
      const d = audio[id];
      panel.querySelector(
        `[data-deck="${id}"] [data-loop-status]`,
      )!.textContent =
        `${d.loop.state} · ${d.loop.events.length} EVENTS · ${d.loop.bars} BARS`;
      overlay
        .querySelectorAll<HTMLElement>(`[data-deck="${id}"] [data-edge]`)
        .forEach((b) => {
          b.classList.toggle(
            "sounding",
            d.drone.phase(
              b.dataset.edge as (typeof edges)[number],
              +b.dataset.index!,
            ) !== "OFF",
          );
          b.title = `${b.dataset.edge!.toUpperCase()} ${+b.dataset.index! + 1} · ${d.genre === "drone" ? d.drone.segmentSettings(+b.dataset.index!).layers[b.dataset.edge as (typeof edges)[number]].preset : d.sound === "genre" ? d.genre : presets.find((p) => p.id === d.sound)?.name}`;
        });
    }
  }, 100);
  return {
    audio,
    get active() {
      return active;
    },
    targets,
    processHands(hands: Hand[], now: number, mirror: boolean) {
      const result = gestures.update(hands, now, mirror);
      if (result.fade !== undefined) fade(result.fade);
      result.actions.forEach((a) => command(a.deck, a.action));
      panel.querySelector("#dj-gesture-status")!.textContent = gestures.status;
      return result.suppressed;
    },
    contact(e: BodyContactEvent) {
      if (e.eventType !== "ENTER" || !active) return;
      audio[e.deckId as "A" | "B"].hit(e.edge, e.segmentIndex, e.velocity);
      feedback(e.deckId, e.edge, e.segmentIndex);
    },
    dispose() {
      clearInterval(timer);
      audio.dispose();
      panel.remove();
      overlay.remove();
      switcher.remove();
    },
  };
}
