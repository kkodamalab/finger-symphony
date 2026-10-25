const { chromium } = require("playwright-core");
const path = require("node:path");
const os = require("node:os");
const base =
  process.env.FINGER_BASE_URL || "http://127.0.0.1:5173/finger-symphony/";
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(new URL("body-contact-fixture.local.html", base).href);
    await page.waitForFunction(() => window.bodyFixture);
    const pose = async (x, y) =>
      page.evaluate(
        ({ x, y }) => {
          const ps = Array.from({ length: 33 }, () => ({
            x: 0,
            y: 0,
            visibility: 0,
          }));
          ps[0] = { x: 1 - x, y, visibility: 1 };
          window.bodyFixture.state.pose = ps;
        },
        { x, y },
      );
    const rms = () =>
      page.evaluate(async () => {
        let max = 0;
        for (let i = 0; i < 20; i++) {
          const data = window.bodyFixture.meter.getValue();
          max = Math.max(
            max,
            Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length),
          );
          await new Promise((r) => setTimeout(r, 15));
        }
        return max;
      });
    await pose(0.5, 0.5);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#start").click();
    await page.waitForFunction(() =>
      document.querySelector("#camera-status").textContent.includes("READY"),
    );
    await page.locator("#settings-toggle").click();
    await page.locator("#debug-settings summary").click();
    await page.locator("#stop").click();
    assert(await page.locator("#start").isVisible());
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator("#start").click();
    await page.locator("#audio").click();
    await page.waitForTimeout(300);
    await pose(0.35, 0.2);
    const solo = await rms();
    assert(solo > 1e-5, "Body head contact should produce audio");
    console.log("solo body RMS", solo);
    await page.evaluate(() => {
      const p = Array.from({ length: 33 }, () => ({
        x: 0,
        y: 0,
        visibility: 0,
      }));
      [11, 12, 24, 23].forEach(
        (i, n) =>
          (p[i] = {
            x: n === 0 || n === 3 ? 0.05 : 0.95,
            y: n < 2 ? 0.05 : 0.95,
            visibility: 1,
          }),
      );
      window.bodyFixture.state.pose = p;
    });
    await page.waitForTimeout(400);
    assert(
      !/ERROR/.test(await page.locator("#tracking-status").innerText()),
      "simultaneous torso contacts must not break inference",
    );
    await pose(0.5, 0.5);
    await page.locator("[data-layout=mix]").click();
    await page
      .locator("body.dj-mode #dj-audio, body:not(.dj-mode) #audio")
      .click();
    await page.waitForTimeout(400);
    await pose(0.5, 0.5);
    await page.waitForTimeout(200);
    const a = page.locator("#dj-panel [data-deck=A]"),
      b = page.locator("#dj-panel [data-deck=B]");
    await a.locator("[data-setting=bars]").selectOption("1");
    await a.locator("[data-action=REC]").click();
    await pose(0.23, 0.17);
    const mix = await rms();
    assert(mix > 1e-5, "DJ A body should produce audio");
    await page.waitForTimeout(400);
    assert.match(
      await a.locator("[data-loop-status]").innerText(),
      /[1-9]\d* EVENTS/,
    );
    console.log("DJ head RMS", mix);
    await a.locator("[data-action=STOP]").click();
    await pose(0.5, 0.5);
    await page.locator("#dj-audio").click();
    await page.waitForTimeout(200);
    await page.locator("#dj-audio").click();
    await page.waitForTimeout(200);
    assert((await rms()) < 1e-7, "no unrecorded accompaniment");
    await a.locator("[data-action=PLAY]").click();
    assert((await rms()) > 1e-5, "recorded body event must replay audibly");
    await a.locator("[data-action=OVERDUB]").click();
    await page
      .locator('#dj-overlay [data-deck=A] [data-edge=top][data-index="2"]')
      .click();
    await page.waitForTimeout(200);
    assert.match(await a.locator("[data-loop-status]").innerText(), /2 EVENTS/);
    await a.locator("[data-action=OVERDUB]").click();
    await page.waitForTimeout(150);
    assert.match(await a.locator("[data-loop-status]").innerText(), /PLAYING/);
    await b.locator("[data-setting=genre]").selectOption("jungle");
    await b.locator("[data-action=REC]").click();
    await page
      .locator('#dj-overlay [data-deck=B] [data-edge=top][data-index="1"]')
      .click();
    await page.waitForTimeout(200);
    assert.match(
      await b.locator("[data-loop-status]").innerText(),
      /[1-9]\d* EVENTS/,
    );
    await a.locator("[data-action=STOP]").click();
    assert.match(
      await b.locator("[data-loop-status]").innerText(),
      /RECORDING/,
    );
    page.once("dialog", (d) => d.dismiss());
    await a.locator("[data-action=CLEAR]").click();
    assert.match(await a.locator("[data-loop-status]").innerText(), /2 EVENTS/);
    page.once("dialog", (d) => d.accept());
    await a.locator("[data-action=CLEAR]").click();
    await page.waitForTimeout(150);
    assert.match(await a.locator("[data-loop-status]").innerText(), /0 EVENTS/);
    await page.locator("#dj-panic").click();
    await page.waitForTimeout(400);
    assert((await rms()) < 1e-7, "panic must silence both decks");
    await a.locator("[data-setting=genre]").selectOption("drone");
    await a.locator("[data-editor=A]").evaluate((e) => (e.open = true));
    await a.locator("[data-cell=fadeIn]").fill("0");
    await a.locator("[data-cell=fadeIn]").dispatchEvent("change");
    await page
      .locator("body.dj-mode #dj-audio, body:not(.dj-mode) #audio")
      .click();
    await page.waitForTimeout(300);
    await page.locator("#dj-fade").fill("0");
    await page.locator("#dj-fade").dispatchEvent("input");
    await page
      .locator('#dj-overlay [data-deck=A] [data-edge=bottom][data-index="0"]')
      .click();
    await page.waitForTimeout(300);
    const left = await rms();
    await page.locator("#dj-fade").fill("1");
    await page.locator("#dj-fade").dispatchEvent("input");
    await page.waitForTimeout(300);
    const right = await rms();
    console.log("fade measurements", left, right);
    assert(left > 1e-5, "drone segment should sound");
    assert(right < 1e-7, "crossfader must isolate B");
    console.log("crossfade RMS", left, right);
    await page
      .locator("body.dj-mode #dj-audio, body:not(.dj-mode) #audio")
      .click();
    await page.waitForTimeout(300);
    assert((await rms()) < 1e-7);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(os.tmpdir(), "finger-dj-mobile.png"),
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "mobile overflow",
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: path.join(os.tmpdir(), "finger-dj-desktop.png"),
      fullPage: true,
    });
    await page.locator("[data-layout=solo]").click();
    await page.locator("#modes [data-mode=drone]").click();
    const imported = await page.evaluate(async () => {
      const { defaults } = await import(
        "/finger-symphony/src/drone/settings.ts"
      );
      return JSON.stringify({
        version: 2,
        segments: 3,
        banks: [defaults(), defaults(), defaults()],
      });
    });
    await page.locator("#drone-panel [data-import]").setInputFiles({
      name: "segments.json",
      mimeType: "application/json",
      buffer: Buffer.from(imported),
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#drone-panel [data-message]").textContent ===
        "IMPORTED",
    );
    assert.equal(await page.locator("#edge-segments").inputValue(), "3");
    assert.equal(await page.locator("#area .edge.top span").count(), 3);
    assert.equal(
      await page.locator("#drone-panel [data-segment] option").count(),
      3,
    );
    assert.deepEqual(errors, []);
    console.log("DJ browser integration passed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
