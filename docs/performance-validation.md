# Playground performance validation

## Settings and lifecycle

Playground defaults to **HANDS ONLY / BALANCED**. Its new localStorage key is `finger-symphony-performance-v1`; existing frame, genre, SOUND LAB, DJ and DRONE saved data are unchanged. RHYTHM REACH keeps its independent Pose/duo tracker.

| Preset | Requested camera resolution | Hands maximum | Pose maximum (BODY CONTACT only) | Render target |
| --- | --- | --- | --- | --- |
| QUALITY | 1280 × 720 | 30 fps | 15 fps | 60 fps |
| BALANCED | 960 × 540 | 20 fps | 10 fps | 60 fps |
| LIGHT | 640 × 360 | 12 fps | 6 fps | 30 fps |

Camera sizes are **ideal constraints**, not promises. A stream ending is reported as ERROR with restart available; diagnostics also show the age of the last advancing video frame, and RECOVER restarts a stalled camera. The diagnostic panel reports the actual track size. applyConstraints preserves the stream where supported; failure triggers a guarded stop/restart. Existing normalized coordinates, mirroring and `object-fit: fill` presentation are unchanged across presets.

HANDS ONLY never initializes or calls Pose. Solo uses the existing fingertip crossing/contact path; DRONE and DJ use fingertip geometry with the existing segmented/deck contact tracker. BODY CONTACT uses Hands plus Pose, feeding one aggregate contact tracker so the separate fingertip crossing path does not also fire. Engine changes invalidate pending initialization, release models, clear stale results/contacts and briefly suppress new contacts while the input settles. The camera stream is retained.

One synchronous Hands or Pose inference is admitted per animation turn, with separate rate limits and video-time checks. Missed inference slots are discarded, never queued. Rendering has an independent budget. FaceTracker runs only for an active, unlocked HAND FRAME session and closes when locked, disabled or the camera stops. Hidden motion graphs are not drawn; coordination analysis is capped at 20 Hz and skipped when neither diagnostics nor musical mappings/tempo use it. Motion history is retained for music. COLOR TO MUSIC retains its original color-to-scale mapping and stops sampling when off/locked.

Audio uses the existing Tone context/Transport. Resume occurs directly within user activation. Buttons expose OFF / STARTING / ON / STOPPING / ERROR and disable during pending operations; errors stop engines and permit retry. Stopped accompaniment owns no pattern schedule. The DJ loop clock is installed only while at least one loop is running, and cleared when both stop. Unused genre engines are disposed when not referenced by recorded loops; disabled decks dispose their voices. Non-DRONE decks do not start a DRONE clock unless a recorded loop needs it. Existing volume ramps, PANIC STOP and sound algorithms are retained.

## Measurements (2026-10-29 JST)

These are cloud/headless measurements, **not physical-camera or mobile benchmarks**.

The synthetic browser fixture uses a canvas stream and replacement model outputs. This measures rate limiting and UI behavior, not neural-model speed:

| Preset | Render FPS | Hands FPS | Pose |
| --- | ---: | ---: | --- |
| QUALITY | 59.8 | 29.9 | INACTIVE |
| BALANCED | 60.0 | 20.0 | INACTIVE |
| LIGHT | 30.0 | 12.0 | INACTIVE |

Actual MediaPipe models were separately measured in headless Chromium 154 on Linux, using a blank canvas at each requested size. Hands selected its GPU delegate. Ten calls were averaged after two warmup calls for each preset:

| Canvas size | Hands inference mean | Pose inference mean |
| --- | ---: | ---: |
| 1280 × 720 | 300.6 ms | 357.8 ms |
| 960 × 540 | 299.8 ms | 355.4 ms |
| 640 × 360 | 301.1 ms | 376.3 ms |

The models loaded and returned no detections on the blank images. These times show that lower camera resolution alone does not guarantee lower model cost. Real-model render FPS, physical camera latency, human gesture accuracy, audible dropout/click behavior, and mobile hardware performance remain **unverified**. Inference still runs synchronously on the main thread; slow model calls can block drawing and delay audio scheduling. This change limits workload and exposes the cause; it does not guarantee elimination of dropouts on every device.

## Checks and reproduction

- Unit tests: 295 passed across 27 files. They cover model lifecycle/cancellation, Hands-only Pose inactivity, preset constraints, rate limits/reentrancy, measured rates, INACTIVE display, persisted settings, toggle state, camera constraint failure, and audio schedule ownership, alongside existing regressions.
- `scripts/performance-check.cjs`: synthetic Hands HIT, THEREMIN, HAND FRAME nod/stop, Pose on/off with stream retained, quality constraints/restart fallback, camera switching/mirroring, geometry, COLOR TO MUSIC gating, AudioContext failure/retry, persistence, and layouts at 1280×900, 390×844 and 844×390.
- `scripts/browser-check.cjs`: synthetic full-body contacts to real WebAudio, independent DJ decks, recording/playback/overdub, stopped-loop clock release, crossfade, DRONE and imports.
- `scripts/gesture-check.cjs`: gesture recording, playback/stop, overdub and pinch crossfade in Hands-only DJ.
- `scripts/ui-check.cjs`: prior UI/skeleton regressions.
- SOUND LAB offline signal checks: 57/57 passed; RHYTHM REACH entry and existing unit regressions passed.

Run `npm test`, `npm run build`, and start Vite. Browser scripts require Playwright Core and Chromium supplied separately (no new application dependency). For example:

```sh
NODE_PATH=/path/to/tools/node_modules node scripts/performance-check.cjs
```

For an actual dropout, open DEBUG / FRAME, use COPY DIAGNOSTICS, and record the selected engine/preset, genre, whether a loop was active, and the action immediately before the dropout. The copied report contains timestamp, browser, measured rates/model timings, actual camera size, context/Transport state, tracked schedule counts, long-frame/error/recovery counts. Exact WebAudio voice/node counts are N/A; no camera images or geolocation are included. Metrics update once per second; total inference is the measured Hands+Pose work in that window (not a fabricated per-frame sum).
