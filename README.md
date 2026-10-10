# Finger Symphony v3 — Music Playground

## Phase 2 + 3: Duo Tracking / Rhythm Reach 2D

The default page now opens **RHYTHM REACH 2D**. **MUSIC PLAYGROUND** opens the original application at `?view=playground`; its camera lifecycle and music controls are retained.

1. Run `npm install` and `npm run dev`, then open the local URL in a camera-capable browser.
2. Choose SOLO or DUO (game modes CO-OP and BATTLE select DUO automatically).
3. Click START CAMERA. Allow camera access and wait for the two MediaPipe models to load.
4. In DUO, the person on the displayed left registers as blue P1; the person on the right registers as red P2. Raise both hands above the shoulders continuously for one second. SOLO can instead register just L or R.
5. START becomes available only when registration and the required current tracks are stable. Clicking it unlocks audio and starts the 3–2–1–START countdown.
6. Move the labeled hand from outside a target into its circle on the beat, then return outside. Results appear after the session. An interrupted battle does not declare a winner.

**DUO TRACKING DEMO** displays the camera, independent body/hand skeleton toggles, blue/red identities, anatomical L/R labels, fingertip normalized X/Y, people/hand counts, render/inference FPS, inference duration and TRACKING/LOST/UNCERTAIN states. The camera selector uses actual video-input device IDs. Camera background and mirroring are independent; changing mirror mode resets registration. Video and overlay use the same full-frame coordinate mapping (no cover crop).

### Tracking and recovery

Pose Landmarker is configured for two poses; Hand Landmarker for four hands. Models attempt GPU first and fall back to CPU. The WASM runtime is pinned to the installed/locked MediaPipe version 0.10.35. Model files are fetched from Google's model storage and WASM from jsDelivr; an initial network connection is required. Frames are processed locally and are not uploaded.

Person assignment uses unique nearest shoulder-center matching against previous accepted poses, independent of detector array order. Anatomical left/right comes from visible pose wrists; hand landmarks attach only to an unambiguous, unique wrist. A missing hand never falls back to an inferred fingertip. Brief loss (up to 1.5 seconds) can recover the previous ID. Overlapping people, ambiguous person assignments, or longer loss require explicit recalibration, because geometry alone cannot establish identity after two people cross. HIT is suppressed for uncertain/lost tracks; reacquisition inside a target cannot score.

CameraSession continues to own stream start/stop/switch separately from model loading. The new view has explicit tracking recovery and a bounded two-attempt stall/error watchdog. Stopping the camera invalidates pending initialization and releases model resources. Backgrounding the page or an interrupted audio context ends the current game.

### Game and timing

- SOLO charts cycle alternate, simultaneous and crossed reaches, respecting one-hand selection.
- CO-OP charts cycle alternate, simultaneous, MIRROR, FOLLOW and SHARED patterns. FOLLOW is a scripted P1 reach followed by the same P2 reach one beat later; it is not free-form motion recording. SHARED requires both designated hands to enter in the window before either participant receives credit.
- BATTLE has the same notes, timing, relative positions, target radii and scoring opportunities for both players. Score, combo, max combo and grade counts are kept separately; CO-OP results also show the combined score.
- Settings: 60–160 BPM, 10–180 seconds, EASY/NORMAL/HARD chart density and travel distance, horizontal/vertical/mixed layouts, 1–4 visible targets (BATTLE rounds down to an even limit of at least 2), target radius, reach range, and SOLO hand selection. Defaults are PERFECT ±80 ms, GREAT ±160 ms, GOOD ±250 ms. Windows are editable with ordered validation; outside GOOD becomes MISS.
- Each note requires fresh outside-to-inside evidence from its designated player/hand. Holding a hand in place, duplicate timestamps, stale outside samples, loss/reacquisition and simultaneous overlapping notes cannot produce repeated hits from a single entry.
- Backing tracks reuse the original Tone.js MusicEngine, its six genres and Tone's singleton AudioContext. The transport starts at the countdown origin with the selected BPM applied immediately (no tempo ramp). P1 HIT uses a sine voice and P2 a triangle voice; volume and mute cover both accompaniment and hits. AMBIENT adds a quiet pulse for rhythm play. Music-mode changes stop the session and its transport events. FREE PLAY and RHYTHM REACH are separate page entry points; leaving either stops its streams, voices and transport. Judgments use the same audible clock, using output timestamps when available. Camera samples are timestamped before synchronous inference, so inference duration is not added to hit time. A configurable ±300 ms capture-delay correction accounts for camera latency. Samples taking over 250 ms to infer cannot score. Target circles use screen-pixel distance for both drawing and collision detection.

### Validation and device acceptance

`npm test` covers identity registration/order changes/occlusion/ambiguity, single-hand calibration, hit-window boundaries, entry-only judgment, wrong hands/players, stale samples, shared targets and battle symmetry, alongside the existing regression tests. `npm run build` performs the TypeScript check and production build.

Real-device acceptance remains necessary: test one and two people with all four hands, wrist crossing, short occlusion, person overlap and recalibration; switch between two physical cameras; deny camera permission; test model-download failure and CPU recovery; stop during model loading; compare mirror/background/skeleton toggles; and listen to beat alignment at 60 and 160 BPM. MediaPipe inference runs synchronously, capped at 20 calls per second on new video frames. Rendering can slow on weaker devices; audio scheduling reduces but does not eliminate severe main-thread stalls. Browser display, physical camera tracking and audible latency are not established by unit tests.

### カメラなしDEMOの操作

1. **入力源 → DEMO** を選択します。実カメラは停止し、画面に「DEMO INPUT」と表示します。カメラ登録は不要です。
2. ゲームモードで **SOLO / CO-OP / BATTLE** を選択します。時間を10秒などに設定し、**START** を押します。
3. **P1はマウスまたはタッチ**で操作します。**Q / E** キーで左手／右手、**B** キーで両手を選択します。
4. **P2は矢印キー**で操作します。**J / K** キーで左手／右手、**U** キーで両手を選択します。「DEMO HANDS」の選択欄も使用できます。入力欄にフォーカスがある間はショートカットを実行しません。
5. 両手操作では、もう片方のカーソルをプレイヤー中心線に対して左右対称に配置します。片手SOLOでは「使用する手」の指定を優先します。スケルトンON/OFFは合成の胴体線・腕線を切り替えます。これらはMediaPipeの測定結果ではありません。
6. ラベルで指定された手を円の外から中に入れて得点します。SOLOは個人得点、CO-OPは共同得点、BATTLEはP1/P2別得点と勝敗を結果画面に表示します。DEMOも実カメラと同じ進入・時間窓・スコア処理を使います。

スマホではP1をタッチ操作できます。P2のデモ操作にはキーボードが必要です。実カメラDUOにはキーボードは不要です。

### ターゲットの到達範囲

EASY / NORMAL / HARDは拍の密度だけでなく移動幅を45% / 70% / 100%に変更します。画面端にはターゲット半径以上の余白を確保します。カメラ入力では、登録時の肩の中心と肩→肘→手首の長さから保守的な範囲を作り、DUOでは両者の小さい方の移動幅を使用します。DEMOは固定の幾何学的な範囲です。SHAREDは両者の範囲の共通部分にだけ配置し、共通部分がなければ各自のSIMULTANEOUSターゲットに置換します。これは身体能力を測定・保証するものではなく、実機では無理なく届くようリーチ範囲を下げて確認してください。

### CSV / JSONの保存

セッションを開始すると「SESSION DATA」の3つのボタンが有効になります。終了後、**tracking.csv / events.csv / session.json** をそれぞれ押して保存してください。プレイ中にも、その時点のスナップショットを保存できます。次のSTARTで前の記録は置き換わるため、次のゲームの前に保存してください。

| ファイル | 内容と単位 |
| --- | --- |
| tracking.csv | `timestamp, player_id, hand_side, x, y, tracking_status, confidence, fps, input_source`。timestampは`performance.timeOrigin + performance.now()`による取得時のUNIX epochミリ秒。X/Yは表示座標系の0〜1。fpsは直近の計測値（初期未計測時は空欄）。 |
| events.csv | `target_id, player_id, hand_side, target_x, target_y, scheduled_time, hit_time, timing_error_ms, spatial_error, judgement, score, observed_timestamp`。scheduled/hitは音声上のゲーム開始を0とするミリ秒。timing_errorは符号付き（正＝遅い）。spatial_errorは画面高を1とした円中心からの距離。observed_timestampはHITに使用した取得フレームの補正前epochミリ秒。scoreはそのイベントの加点。 |
| session.json | `game_mode, music_mode, bpm, duration, difficulty, target_size, reach_range, calibration, camera_settings`に加え、入力源、判定窓、遅延補正、配置、表示上限、開始時刻、初期音量、時刻・距離の単位、完了／中断情報。設定は開始時のコピーです。 |

**confidenceの定義:** CAMERAで手が姿勢の手首に一意に対応した場合の、MediaPipe Pose Landmarkerの当該手首の`visibility`値です。人物IDの正解確率、Hand Landmarkerの検出確率、臨床的指標ではありません。元のvisibilityが存在しない場合、手が欠損した場合、DEMO入力の場合は空欄です。confidenceを推定・補間して埋めません。

見えていない手のX/Y・未観測HITの時刻／誤差は空欄にします。フレームが来ない間は実際の監視時刻でLOST行を記録し、座標を前フレームからコピーしません。判定済みMISSと、中断などでまだ判定していない`UNPLAYED`を区別します。SHAREDで片方だけ進入した場合、その実際の進入時刻を残し、共同成功しなければ最終judgementはMISS、scoreは0になります。CSVの`input_source`とJSONの`input_source`でDEMOとCAMERAを必ず区別してください。

### 仕上げ時の検証項目

- `npm test`：従来機能の回帰、4手の割当、遮蔽、進入判定、音声時計、デモ3モード、欠損を含む出力、ターゲット制約。
- `npm run build`：TypeScriptとVite本番ビルド。
- ブラウザー：DEMOで10秒プレイ→結果→3ファイル保存、モード／ジャンル変更による停止、音量／ミュート、P2矢印操作、スマホ幅の表示。
- 実カメラ：SOLOの両手／片手、DUOの4手、身体・手の交差、短い遮蔽、長いロストからの再登録、ミラー対応、物理カメラ切替、GPU失敗時のCPU復旧、モデル読込中の停止。
- 実音声：6ジャンル、P1/P2音色、60/160 BPMでの同期、端末ごとの取得遅延補正。ブラウザー動作や自動テストだけでは実カメラ精度・聴感上の同期は検証済みとしません。

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
