const { chromium } = require("playwright-core");
const path = require("node:path");
const os = require("node:os");
const base =
  process.env.FINGER_BASE_URL || "http://127.0.0.1:5173/finger-symphony/";
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  try {
    const p = await browser.newPage();
    await p.goto(new URL("body-contact-fixture.local.html", base).href);
    await p.waitForFunction(() => window.bodyFixture);
    await p.locator("[data-layout=mix]").click();
    await p.locator("#start").click();
    await p.locator("#dj-audio").click();
    await p.locator("#dj-gestures").check();
    await p.locator("#dj-hold").fill("500");
    await p.locator("#dj-hold").dispatchEvent("change");
    const a = p.locator("#dj-panel [data-deck=A]");
    const shape = async (kind, x = 0.25) =>
      p.evaluate(
        ({ kind, x }) => {
          if (kind === "none") {
            window.bodyFixture.state.hands = [];
            return;
          }
          const y = 0.9;
          const points = Array.from({ length: 21 }, () => ({
            x: 1 - x,
            y: y - 0.02,
            z: 0,
          }));
          points[0] = { x: 1 - x, y, z: 0 };
          points[9] = { x: 1 - x, y: y - 0.08, z: 0 };
          [8, 12, 16, 20].forEach((i, n) => {
            points[i - 2] = { x: 1 - x + (n - 1) * 0.02, y: y - 0.05, z: 0 };
            points[i] = {
              x: 1 - x + (n - 1) * 0.02,
              y:
                y -
                (kind === "open" || (kind === "peace" && n < 2) ? 0.13 : 0.02),
              z: 0,
            };
          });
          points[4] = { x: 1 - x - 0.12, y: y - 0.02, z: 0 };
          if (kind === "pinch") points[4] = { ...points[8] };
          window.bodyFixture.state.hands = [{ side: "Left", points }];
        },
        { kind, x },
      );
    await shape("open");
    await p.waitForTimeout(800);
    assert.match(
      await a.locator("[data-loop-status]").innerText(),
      /RECORDING/,
    );
    assert.match(await p.locator("#dj-gesture-status").innerText(), /✓/);
    await shape("none");
    await p.waitForTimeout(1900);
    await shape("fist");
    await p.waitForTimeout(800);
    assert.match(await a.locator("[data-loop-status]").innerText(), /STOPPED/);
    await shape("none");
    await p.waitForTimeout(1900);
    await shape("peace");
    await p.waitForTimeout(800);
    assert.match(await a.locator("[data-loop-status]").innerText(), /OVERDUB/);
    await shape("none");
    await p.waitForTimeout(200);
    await shape("pinch", 0.25);
    await p.waitForTimeout(200);
    await shape("pinch", 0.9);
    await p.waitForTimeout(200);
    assert(Number(await p.locator("#dj-fade").inputValue()) > 0.9);
    await shape("none");
    await p.waitForTimeout(200);
    assert.match(await p.locator("#dj-gesture-status").innerText(), /READY/);
    console.log("Browser gestures REC, PLAY/STOP, OVERDUB, pinch fader passed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
