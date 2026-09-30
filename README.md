# Finger Symphony v1

Camera-based interactive instrument: each index finger plays a pentatonic melody while bilateral finger flexion maps to a harmony. All camera analysis runs locally in the browser.

## Run
`npm install`, `npm run dev`; validate with `npm run check`, `npm test`, and `npm run build`.

The Pages workflow deploys `main` to `https://kkodamalab.github.io/finger-symphony/` after it is pushed to that repository. Vite's base is already set to `/finger-symphony/`.

## How it works

Allow camera and click **START CAMERA** (which also enables audio). Move either index finger through the performance field to trigger melody pitches. Move both index fingers rhythmically for at least three cycles to enable coordination analysis. Test Mode provides in-phase, anti-phase, 90°, varying, and stopped simulations without a camera.

Phase is computed from normalized angular position and angular velocity; the signed difference is circularly averaged. Stability is mean resultant length `R = |mean(exp(i·phase))|`. In-phase, intermediate, and anti-phase relations select different musical voicings; this is an artistic mapping, not a movement-quality or ability assessment.

## Browser notes

Use current Chrome/Edge or mobile Safari/Chrome over HTTPS. MediaPipe's model CDN must be reachable. GPU initialization is requested; some hardware/browser combinations may fall back at the library level. Camera and physical-device audio verification remain required after publishing.
