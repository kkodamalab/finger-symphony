const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const url =
      "http://127.0.0.1:5173/finger-symphony/body-contact-fixture.local.html";
    await page.goto(url);
    await page.waitForFunction(() => window.bodyFixture);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.locator("#body-start-controls,#panel-toggle").count(),
        0,
      );
      assert.equal(await page.locator("#readouts").isVisible(), false);
      const genres = await page
        .locator("#modes button")
        .evaluateAll((bs) =>
          bs.map((b) => ({
            y: b.getBoundingClientRect().y,
            w: b.getBoundingClientRect().width,
          })),
        );
      assert.equal(new Set(genres.map((b) => b.y)).size, 1);
      assert.equal(new Set(genres.map((b) => Math.round(b.w))).size, 1);
      if (width === 390) await page.locator("#settings-toggle").click();
      assert(await page.locator("#audio").isVisible());
      await page.locator("#debug-settings").evaluate((e) => (e.open = true));
      const before = await page.locator(".stage").boundingBox();
      await page.locator("#show-diagnostics").check();
      assert(await page.locator("#readouts").isVisible());
      const after = await page.locator(".stage").boundingBox();
      assert.equal(before.width, after.width);
      assert.equal(before.height, after.height);
      await page.locator("#show-diagnostics").uncheck();
      assert(await page.locator("#hand-skeleton-settings").isVisible());
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `/tmp/ui-cleanup-${width}.png`,
        fullPage: true,
      });
    }
    for (const [key, value] of [
      ["pointSize", "10"],
      ["lineWidth", "6"],
      ["leftColor", "#ff0000"],
      ["rightColor", "#00ff00"],
      ["opacity", "0.4"],
    ])
      await page.locator(`[data-skeleton=${key}]`).evaluate((e, v) => {
        e.value = v;
        e.dispatchEvent(new Event("input"));
      }, value);
    await page.locator("[data-skeleton=connections]").uncheck();
    await page.reload();
    await page.waitForFunction(() => window.bodyFixture);
    await page.locator("#settings-toggle").click();
    await page.locator("#debug-settings summary").click();
    assert.equal(
      await page.locator("[data-skeleton=pointSize]").inputValue(),
      "10",
    );
    assert.equal(
      await page.locator("[data-skeleton=connections]").isChecked(),
      false,
    );
    const result = await page.evaluate(async () => {
      const { renderHands, loadSkeleton } = await import(
        "./src/render/hand-skeleton.ts"
      );
      const settings = loadSkeleton(),
        c = document.createElement("canvas");
      c.width = c.height = 100;
      const ctx = c.getContext("2d");
      const hand = {
        side: "Left",
        points: Array.from({ length: 21 }, (_, i) => ({
          x: i === 0 ? 0.5 : 0,
          y: i === 0 ? 0.5 : 0,
          z: 0,
        })),
      };
      let arcs = 0,
        lines = 0,
        radius = 0,
        width = 0;
      const arc = ctx.arc.bind(ctx),
        line = ctx.lineTo.bind(ctx);
      ctx.arc = (...args) => {
        arcs++;
        radius = args[2];
        arc(...args);
      };
      ctx.lineTo = (...args) => {
        lines++;
        width = ctx.lineWidth;
        line(...args);
      };
      renderHands(ctx, [hand], (p) => p, 100, 100, settings);
      const pixel = [...ctx.getImageData(50, 50, 1, 1).data];
      settings.points = false;
      settings.connections = true;
      renderHands(ctx, [hand], (p) => p, 100, 100, settings);
      settings.enabled = false;
      const old = [arcs, lines];
      renderHands(ctx, [hand], (p) => p, 100, 100, settings);
      ctx.clearRect(0, 0, 100, 100);
      settings.enabled = true;
      settings.points = true;
      settings.connections = false;
      hand.side = "Right";
      renderHands(ctx, [hand], (p) => p, 100, 100, settings);
      const right = [...ctx.getImageData(50, 50, 1, 1).data];
      return {
        arcs: old[0],
        lines: old[1],
        pixel,
        old,
        alpha: ctx.globalAlpha,
        radius,
        width,
        right,
      };
    });
    assert.equal(result.arcs, 21);
    assert(result.lines > 0);
    assert.deepEqual(result.old, [result.arcs, result.lines]);
    assert.equal(result.pixel[0], 255);
    assert(Math.abs(result.pixel[3] - 255 * 0.4) < 2);
    assert.equal(result.alpha, 1);
    assert.equal(result.radius, 10);
    assert.equal(result.width, 6);
    assert.equal(result.right[1], 255);
    await page.locator("#reset-skeleton").click();
    assert.equal(
      await page.locator("[data-skeleton=pointSize]").inputValue(),
      "4",
    );
    assert(await page.locator("[data-skeleton=connections]").isChecked());
    assert.deepEqual(errors, []);
    console.log(
      "UI PASS: 1280/390px, single-row genres, diagnostics geometry, settings persistence/reset, 21 points, connections, opacity, rendering toggle",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
