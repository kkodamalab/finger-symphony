import { describe, it, expect } from "vitest";
import {
  BodyContacts,
  bodyGeometry,
  intersects,
  type Geometry,
  type Landmark,
} from "./contact";
import type { Hand } from "../tracking/hands";
const target = {
  deckId: "A",
  frame: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
  segments: 4,
};
const point = (x: number, y: number, source = "left-hand"): Geometry => ({
  source,
  region: source,
  points: [{ x, y }],
  confidence: 1,
});
const options = {
  contactDistance: 0.005,
  contactTime: 100,
  hysteresis: 0.005,
  cooldown: 200,
};
const pose = () =>
  Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
describe("body geometry and contacts", () => {
  it.each([
    ["head", 0],
    ["left-upper-arm", 13],
    ["torso", 11],
    ["left-thigh", 25],
    ["left-foot", 31],
  ] as const)(
    "recognizes visible %s without requiring Hands",
    (region, index) => {
      const p = pose();
      p[index] = { x: 0.27, y: 0.2, visibility: 1 };
      expect(
        bodyGeometry(p, []).some(
          (g) =>
            g.region === region &&
            intersects(g, { x: 0.2, y: 0.2, width: 0.15, height: 0 }, 0.005),
        ),
      ).toBe(true);
    },
  );
  it("uses limb segments even when both endpoints are outside the contact band", () => {
    const p = pose();
    p[11] = { x: 0.27, y: 0.1, visibility: 1 };
    p[13] = { x: 0.27, y: 0.3, visibility: 1 };
    expect(
      bodyGeometry(p, []).some(
        (g) =>
          g.region === "left-upper-arm" &&
          intersects(g, { x: 0.2, y: 0.2, width: 0.15, height: 0 }, 0),
      ),
    ).toBe(true);
  });
  it("fills the shoulder/hip torso polygon and ignores hidden joints", () => {
    const p = pose();
    [11, 12, 24, 23].forEach(
      (i, n) =>
        (p[i] = {
          x: n === 0 || n === 3 ? 0.1 : 0.9,
          y: n < 2 ? 0.1 : 0.9,
          visibility: 1,
        }),
    );
    let torso = bodyGeometry(p, []).find((g) => g.region === "torso")!;
    expect(
      intersects(torso, { x: 0.4, y: 0.4, width: 0.1, height: 0 }, 0),
    ).toBe(true);
    p[24].visibility = 0;
    expect(
      bodyGeometry(p, [])
        .filter((g) => g.region === "torso")
        .every((g) => !g.closed),
    ).toBe(true);
  });
  it("uses fingers and palm polygons and mirrors coordinates", () => {
    const h: Hand = {
      side: "Left",
      points: Array.from({ length: 21 }, () => ({ x: 0.73, y: 0.2, z: 0 })),
    };
    const gs = bodyGeometry([], [h], true);
    expect(gs.some((g) => g.closed)).toBe(true);
    expect(gs[0].points[0].x).toBeCloseTo(0.27);
  });
  it("deduplicates overlapping Pose and Hands and emits ENTER/HOLD/EXIT", () => {
    const c = new BodyContacts(),
      gs = [point(0.27, 0.2), point(0.27, 0.2), point(0.27, 0.2, "torso")];
    expect(c.update(gs, [target], 0, options)).toEqual([]);
    const enter = c.update(gs, [target], 100, options);
    expect(enter).toHaveLength(1);
    expect(enter[0]).toMatchObject({
      eventType: "ENTER",
      segmentIndex: 0,
      deckId: "A",
    });
    expect(c.update(gs, [target], 200, options)[0].eventType).toBe("HOLD");
    c.update(
      [point(0.5, 0.5), point(0.5, 0.5, "torso")],
      [target],
      300,
      options,
    );
    expect(
      c.update(
        [point(0.5, 0.5), point(0.5, 0.5, "torso")],
        [target],
        450,
        options,
      )[0].eventType,
    ).toBe("EXIT");
  });
  it("keeps independent segments and decks simultaneous", () => {
    const c = new BodyContacts(),
      b = { ...target, deckId: "B" };
    const gs = [point(0.27, 0.2), point(0.57, 0.2)];
    c.update(gs, [target, b], 0, options);
    const events = c.update(gs, [target, b], 100, options);
    expect(events).toHaveLength(4);
    expect(new Set(events.map((e) => e.contactId)).size).toBe(4);
  });
  it("does not retrigger after missing tracking until an observed release", () => {
    const c = new BodyContacts();
    c.update([point(0.27, 0.2)], [target], 0, options);
    c.update([point(0.27, 0.2)], [target], 100, options);
    expect(c.update([], [target], 200, options)).toEqual([]);
    expect(c.update([point(0.27, 0.2)], [target], 350, options)).toEqual([]);
    c.update([point(0.5, 0.5)], [target], 400, options);
    c.update([point(0.5, 0.5)], [target], 550, options);
    c.update([point(0.27, 0.2)], [target], 600, options);
    expect(
      c.update([point(0.27, 0.2)], [target], 800, options)[0].eventType,
    ).toBe("ENTER");
  });
  it("does not use a visible torso to release a missing hand contact", () => {
    const c = new BodyContacts();
    c.update([point(0.27, 0.2)], [target], 0, options);
    c.update([point(0.27, 0.2)], [target], 100, options);
    c.update([point(0.5, 0.5, "torso")], [target], 200, options);
    expect(
      c.update([point(0.5, 0.5, "torso")], [target], 400, options),
    ).toEqual([]);
  });
  it("suppresses gesture hand and forearm primitives including Pose duplicates", () => {
    const p = Array.from({ length: 33 }, () => ({
      x: 0.3,
      y: 0.2,
      visibility: 1,
    }));
    const h: Hand = {
      side: "Left",
      points: Array.from({ length: 21 }, () => ({ x: 0.3, y: 0.2, z: 0 })),
    };
    const gs = bodyGeometry(
      p,
      [h],
      false,
      new Set(["left-hand", "left-forearm"]),
    );
    expect(
      gs.some((g) => ["left-hand", "left-forearm"].includes(g.region)),
    ).toBe(false);
  });
  it("rejects low confidence landmarks and repeated timestamps", () => {
    const p: Landmark[] = [{ x: 0.2, y: 0.2, visibility: 0.1 }];
    expect(bodyGeometry(p, [])).toEqual([]);
    const c = new BodyContacts();
    c.update([point(0.27, 0.2)], [target], 0, options);
    expect(c.update([point(0.27, 0.2)], [target], 0, options)).toEqual([]);
  });
});

import { associateHands } from "./contact";
it("uses the unique Pose wrist to suppress the same hand across both models", () => {
  const p = pose();
  p[15] = { x: 0.3, y: 0.4, visibility: 1 };
  p[16] = { x: 0.7, y: 0.4, visibility: 1 };
  const h: Hand = {
    side: "Right",
    points: Array.from({ length: 21 }, () => ({ x: 0.31, y: 0.4, z: 0 })),
  };
  expect(associateHands([h], p)[0].side).toBe("Left");
});
it("does not relabel hands when wrist assignment is ambiguous", () => {
  const p = pose();
  p[15] = { x: 0.3, y: 0.4, visibility: 1 };
  p[16] = { x: 0.32, y: 0.4, visibility: 1 };
  const h: Hand = {
    side: "Right",
    points: Array.from({ length: 21 }, () => ({ x: 0.31, y: 0.4, z: 0 })),
  };
  expect(associateHands([h], p)[0].side).toBe("Right");
});
