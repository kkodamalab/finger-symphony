const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(
      "http://127.0.0.1:5173/finger-symphony/body-contact-fixture.local.html",
    );
    await page.waitForFunction(() => window.bodyFixture);
    assert.equal(await page.locator("#tracking-engine").inputValue(), "hands");
    assert.equal(
      await page.locator("#performance-preset").inputValue(),
      "balanced",
    );
    await page.locator("#start").click();
    await page.waitForFunction(() =>
      document.querySelector("#performance-state").textContent.endsWith("ON"),
    );
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => window.bodyFixture.state.poseInit),
      0,
    );
    await page.locator("#debug-settings summary").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#performance-diagnostics")
        .textContent.includes("POSE FPS INACTIVE"),
    );
    await page.locator("#auto").click();
    assert.equal(
      await page.locator("#auto").getAttribute("aria-checked"),
      "false",
    );
    await page.locator("#audio").click();
    await page.waitForFunction(
      () => document.querySelector("#audio").dataset.operationState === "ON",
    );
    const hand = async (y) =>
      page.evaluate((y) => {
        window.bodyFixture.state.hands = [
          {
            side: "Left",
            points: Array.from({ length: 21 }, (_, i) => ({
              x: i === 8 ? 0.65 : 0.5,
              y: i === 8 ? y : 0.5,
              z: i / 100,
            })),
          },
        ];
      }, y);
    await hand(0.4);
    await page.waitForTimeout(150);
    await hand(0.1);
    await page.waitForFunction(() =>
      /HITS [1-9]/.test(
        document.querySelector("#audio-diagnostics").textContent,
      ),
    );
    assert.match(
      await page.locator("#audio-diagnostics").innerText(),
      /HITS [1-9]/,
    );
    await page.locator("#theremin").focus();
    await page.keyboard.press("Space");
    assert.equal(
      await page.locator("#theremin").getAttribute("aria-checked"),
      "true",
    );
    await hand(0.6);
    await page.waitForTimeout(150);
    assert.match(
      await page.locator("#theremin-readout").innerText(),
      /PITCH \d+%/,
    );
    await page.locator("#theremin").click();
    await page.locator("#hand-frame").click();
    await page.waitForFunction(() => window.bodyFixture.state.faceCalls > 0);
    await page.evaluate(() => (window.bodyFixture.state.faceY = 0.55));
    await page.waitForTimeout(200);
    await page.evaluate(() => (window.bodyFixture.state.faceY = 0.5));
    await page.waitForFunction(
      () =>
        document.querySelector("#frame-status").textContent === "FRAME LOCKED",
    );
    const faceCalls = await page.evaluate(
      () => window.bodyFixture.state.faceCalls,
    );
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() => window.bodyFixture.state.faceCalls),
      faceCalls,
    );
    await page.locator("#default-frame").click();
    assert.equal(
      await page.locator("#hand-frame").getAttribute("aria-checked"),
      "false",
    );
    const streamBefore = await page.evaluate(() => {
      window.savedStream = document.querySelector("#video").srcObject;
      return window.savedStream.id;
    });
    await page.locator("#tracking-engine").selectOption("body");
    await page.waitForFunction(() => window.bodyFixture.state.poseCalls > 0);
    assert.equal(
      await page.evaluate(() => document.querySelector("#video").srcObject.id),
      streamBefore,
    );
    await page.locator("#tracking-engine").selectOption("hands");
    await page.waitForFunction(() =>
      document.querySelector("#performance-state").textContent.endsWith("ON"),
    );
    const calls = await page.evaluate(() => window.bodyFixture.state.poseCalls);
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => window.bodyFixture.state.poseCalls),
      calls,
    );
    assert(await page.evaluate(() => window.bodyFixture.state.poseClose > 0));
    const measurements = [];
    for (const preset of ["quality", "balanced", "light"]) {
      await page.locator("#performance-preset").selectOption(preset);
      await page.waitForTimeout(2100);
      assert.equal(
        await page.evaluate(
          () => document.querySelector("#video").srcObject.id,
        ),
        streamBefore,
      );
      assert(
        await page
          .locator("#video")
          .evaluate((v) => v.classList.contains("mirrored")),
      );
      const geometry = await page.evaluate(() => {
        const v = document.querySelector("#video").getBoundingClientRect(),
          c = document.querySelector("#canvas").getBoundingClientRect(),
          f = document.querySelector("#area");
        return {
          videoWidth: v.width,
          canvasWidth: c.width,
          videoHeight: v.height,
          canvasHeight: c.height,
          left: f.style.left,
          top: f.style.top,
        };
      });
      assert.equal(geometry.videoWidth, geometry.canvasWidth);
      assert.equal(geometry.videoHeight, geometry.canvasHeight);
      assert.equal(geometry.left, "18%");
      assert.equal(geometry.top, "20%");
      measurements.push({
        preset,
        diagnostics: await page.locator("#performance-diagnostics").innerText(),
      });
    }
    await page.locator("#switch").click();
    await page.waitForFunction(() =>
      document.querySelector("#performance-state").textContent.endsWith("ON"),
    );
    assert.equal(
      await page
        .locator("#video")
        .evaluate((v) => v.classList.contains("mirrored")),
      false,
    );
    const requests = await page.evaluate(() => {
      document
        .querySelector("#video")
        .srcObject.getVideoTracks()[0].applyConstraints = async () => {
        throw Error("synthetic unsupported constraints");
      };
      return window.bodyFixture.state.cameraRequests;
    });
    await page.locator("#performance-preset").selectOption("quality");
    await page.waitForFunction(() =>
      document.querySelector("#performance-state").textContent.endsWith("ON"),
    );
    assert.equal(
      await page.evaluate(() => window.bodyFixture.state.cameraRequests),
      requests + 1,
    );
    assert.equal(
      await page.evaluate(
        () => window.bodyFixture.state.constraints.video.width.ideal,
      ),
      1280,
    );
    assert.equal(
      await page
        .locator("#video")
        .evaluate((v) => v.classList.contains("mirrored")),
      false,
    );
    await page.locator("#performance-preset").selectOption("light");
    await page.locator("#color").click();
    assert.equal(
      await page.locator("#color").getAttribute("aria-checked"),
      "true",
    );
    await page.waitForTimeout(500);
    const color = await page.locator("#detected-color").innerText();
    assert.notEqual(color, "COLOR —");
    await page.locator("#color").click();
    await page.waitForTimeout(500);
    assert.equal(await page.locator("#detected-color").innerText(), color);
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      if (viewport.width === 390)
        await page.locator("#settings-toggle").click();
      assert(await page.locator("#performance-settings").isVisible());
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const target = await page.locator("#color").boundingBox();
      assert(target.height >= 44);
      await page.screenshot({
        path: `/tmp/performance-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.locator("#stop").click();
    assert(await page.locator("#start").isVisible());
    await page.waitForFunction(
      () => document.querySelector("#audio").dataset.operationState === "OFF",
    );
    await page.evaluate(() => {
      const context = window.bodyFixture.Tone.getContext();
      const resume = context.resume.bind(context);
      context.resume = async () => {
        context.resume = resume;
        throw Error("synthetic resume rejection");
      };
    });
    await page.locator("#audio").click();
    await page.waitForFunction(
      () => document.querySelector("#audio").dataset.operationState === "ERROR",
    );
    assert(await page.locator("#audio").isEnabled());
    await page.locator("#audio").click();
    await page.waitForFunction(
      () => document.querySelector("#audio").dataset.operationState === "ON",
    );
    await page.locator("#audio").click();
    await page.waitForFunction(
      () => document.querySelector("#audio").dataset.operationState === "OFF",
    );
    await page.reload();
    await page.waitForFunction(() => window.bodyFixture);
    assert.equal(await page.locator("#tracking-engine").inputValue(), "hands");
    assert.equal(
      await page.locator("#performance-preset").inputValue(),
      "light",
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        { passed: true, syntheticInput: true, measurements },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
