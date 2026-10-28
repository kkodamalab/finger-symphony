import { syncToggleInputs } from "../ui/toggle";
import type { Hand } from "../tracking/hands";
import type { Point } from "../performance/frame";
export const DEFAULTS = {
  enabled: true,
  points: true,
  connections: true,
  pointSize: 4,
  lineWidth: 2,
  leftColor: "#68e8ff",
  rightColor: "#ff54d7",
  opacity: 0.9,
};
export type SkeletonSettings = typeof DEFAULTS;
const KEY = "finger-symphony-hand-skeleton-v1";
export function loadSkeleton(): SkeletonSettings {
  const result = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    for (const key of ["enabled", "points", "connections"] as const)
      if (typeof saved[key] === "boolean") result[key] = saved[key];
    for (const [key, min, max] of [
      ["pointSize", 1, 12],
      ["lineWidth", 0.5, 8],
      ["opacity", 0.1, 1],
    ] as const)
      if (typeof saved[key] === "number" && Number.isFinite(saved[key]))
        result[key] = Math.max(min, Math.min(max, saved[key]));
    for (const key of ["leftColor", "rightColor"] as const)
      if (/^#[\da-f]{6}$/i.test(saved[key])) result[key] = saved[key];
  } catch {
    /* Use defaults if storage is unavailable or invalid. */
  }
  return result;
}
export function mountSkeleton(parent: HTMLElement): SkeletonSettings {
  const settings = loadSkeleton();
  const panel = document.createElement("fieldset");
  panel.id = "hand-skeleton-settings";
  panel.innerHTML = `<legend>HAND SKELETON SETTINGS</legend>${(["enabled", "points", "connections"] as const).map((key, i) => `<label><input type="checkbox" data-skeleton="${key}">${["Skeleton", "Landmark Points", "Connections"][i]}</label>`).join("")}${(
    [
      ["pointSize", "Point Size", 1, 12, 1],
      ["lineWidth", "Line Width", 0.5, 8, 0.5],
      ["opacity", "Opacity", 0.1, 1, 0.1],
    ] as const
  )
    .map(
      ([key, label, min, max, step]) =>
        `<label>${label}<input type="range" data-skeleton="${key}" min="${min}" max="${max}" step="${step}"><output></output></label>`,
    )
    .join(
      "",
    )}<label>Left Hand Color<input type="color" data-skeleton="leftColor"></label><label>Right Hand Color<input type="color" data-skeleton="rightColor"></label><button type="button" id="reset-skeleton">RESET DEFAULTS</button>`;
  parent.append(panel);
  const sync = () => {
    panel
      .querySelectorAll<HTMLInputElement>("[data-skeleton]")
      .forEach((input) => {
        const key = input.dataset.skeleton as keyof SkeletonSettings;
        const value = settings[key];
        if (typeof value === "boolean") input.checked = value;
        else input.value = String(value);
        if (input.nextElementSibling?.tagName === "OUTPUT")
          input.nextElementSibling.textContent =
            key === "opacity"
              ? Math.round(Number(value) * 100) + "%"
              : value + "px";
      });
    syncToggleInputs(panel);
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {}
    sync();
  };
  panel.querySelectorAll<HTMLInputElement>("[data-skeleton]").forEach(
    (input) =>
      (input.oninput = () => {
        const key = input.dataset.skeleton!;
        Object.assign(settings, {
          [key]:
            input.type === "checkbox"
              ? input.checked
              : input.type === "range"
                ? Number(input.value)
                : input.value,
        });
        save();
      }),
  );
  panel.querySelector<HTMLButtonElement>("#reset-skeleton")!.onclick = () => {
    Object.assign(settings, DEFAULTS);
    save();
  };
  sync();
  return settings;
}
export function renderHands(
  ctx: CanvasRenderingContext2D,
  hands: Hand[],
  project: (p: Point) => Point,
  width: number,
  height: number,
  settings: SkeletonSettings,
) {
  if (!settings.enabled) return;
  ctx.save();
  ctx.globalAlpha = settings.opacity;
  ctx.lineWidth = settings.lineWidth;
  for (const hand of hands) {
    const points = hand.points.map(project);
    ctx.strokeStyle = ctx.fillStyle =
      hand.side === "Left" ? settings.leftColor : settings.rightColor;
    if (settings.connections)
      for (const chain of [
        [0, 1, 2, 3, 4],
        [0, 5, 6, 7, 8],
        [5, 9, 10, 11, 12],
        [9, 13, 14, 15, 16],
        [13, 17, 18, 19, 20],
        [0, 17],
      ]) {
        ctx.beginPath();
        chain.forEach((n, i) =>
          i
            ? ctx.lineTo(points[n].x * width, points[n].y * height)
            : ctx.moveTo(points[n].x * width, points[n].y * height),
        );
        ctx.stroke();
      }
    if (settings.points)
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, settings.pointSize, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  ctx.restore();
}
