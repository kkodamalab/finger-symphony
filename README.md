# Finger Symphony v3 — Music Playground

A camera-optional musical playground for exploring how fingertip motion and bilateral coordination can control a future whole-body instrument. MediaPipe hand tracking, frame crossing, free/hybrid play, editable normalized performance frame, phase analysis, and the ten-second movement graph from v2 remain available.

## Start and validate

```bash
npm install
npm run dev
npm run check
npm test
npm run build
```

Click **AUDIO ON** before playing. Camera and audio are independent. All camera and microphone processing stays inside the browser.

## Camera-free demo (recommended)

1. Select **DEMO MODE**: 0°, 90°, 180°, VARIABLE, or STOP.
2. Choose BAND, TECHNO, AMBIENT, DUB, DUBSTEP, or JUNGLE from the mode bar.
3. Enable audio, then drag or swipe across any performance-frame edge.
4. Watch edge labels, note flashes, trails, phase/stability, chord, and BPM readouts.

The simulation supplies bilateral flexion waves for coordination analysis while pointer/touch supplies independent frame gestures. It therefore works without camera permission.

## Music modes

| Mode | BPM | Rhythm | Body control |
| --- | ---: | --- | --- |
| BAND | 100 | 8 Beat / Funk / Bossa | Frame gestures |
| TECHNO | 125 | Four-on-the-floor | Frame gestures |
| AMBIENT | 60 | Free time | Coordination / edge proximity |
| DUB | 75 | Dub | Delay / space |
| DUBSTEP | 140 | Half-time | Hand distance → wobble |
| JUNGLE | 170 | Generated breakbeat | Hand speed → break intensity |

DUBSTEP uses a synthesized sub/wobble voice—no copyrighted samples—with hand distance controlling smoothed filter cutoff, LFO rate, and resonance. Its frame maps bottom to kick/sub, top to bass stab/lead, left to snare/percussion, and right to wobble/filter accents.

JUNGLE generates four original 16-step break patterns from kick, snare, hi-hat, ghost-note, percussion, and bass synth voices. Smoothed fingertip speed selects pattern density with hysteresis and cooldown; crossing the right edge advances a variation/fill without changing the 170 BPM foundation.

Auto accompaniment can be disabled. Quantization is OFF, 1/4, 1/8, or 1/16. Mode defaults can be overridden using rhythm, BPM, key, scale, progression, quantize, and volume controls.

## Music generation

The engine separates mode/rhythm configuration, tempo analysis, scale/chord theory, environmental inputs, and Tone.js rendering. Six scales and POP (I–V–vi–IV), JAZZ (ii–V–I), AMBIENT, and DUB progressions constrain generated notes. EXPERIMENTAL adds chromatic tension.

Frame crossings carry edge, zone, speed, and direction. Bottom supplies foundations, top melody, left rhythm/texture, and right accompaniment/effects. The segment detector catches high-speed crossings and retains v2 cooldown, minimum-distance, hysteresis, and lost-hand reset protections.

Relative phase maps to voicing or genre-specific processing; coordination stability continuously changes tension, filtering/reverb, detune-like space, or dub effects. Chords have region hysteresis and are re-attacked only when their musical identity changes.

## Input sources

- **MANUAL**: 40–180 BPM slider.
- **BODY**: estimates a stable period from index-flexion peaks and smoothly updates transport tempo.
- **MIC**: local transient interval estimate with half/double-tempo reconciliation and confidence display; denied access falls back to MANUAL.
- **WEATHER**: location plus Open-Meteo wind speed, mapped as `55 + 2.25 × km/h` and clamped to 55–145 BPM; errors fall back to MANUAL.
- **COLOR TO MUSIC**: samples the camera center, converts RGB to HSV, waits for eight stable samples, and maps color families to scale selection without changing the manually selected music mode. COLOR LOCK freezes the result.

## Deployment

Pushes to `main` are built by `.github/workflows/deploy.yml` and deployed to `https://kkodamalab.github.io/finger-symphony/`. Vite uses `/finger-symphony/` as its base path. Real camera, microphone, mobile touch, physical audio, network inputs, and browser autoplay behavior must be checked on an HTTPS device after deployment.
