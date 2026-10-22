# Finger Symphony v3 — Music Playground

## SOUND LAB — SIMPLE / DETAIL

Music Playground (`?view=playground`) の **SOUND LAB** から音色を編集できます。開くとPlaygroundの音声を停止します。カメラ・手指判定の設定は変更しません。

1. カテゴリーとプリセットを選び、**PREVIEW** で試聴します。DRUMSは単発、BASSは低音フレーズ、SYNTH / INSTRUMENTは短い音階、VOICEは短い発声音、FX / NATUREは単発音です。**STOP** または画面を閉じる操作で停止します。
2. **SIMPLE** は日本語説明付きの0–100スライダーです。BRIGHTNESS → Cutoff、BODY → Low EQ / Oscillator Mix、ATTACK → Attack、LENGTH → Decay / Release、SPACE → Reverb Wet、CHARACTER → Distortionを変更します。各項目を選択時の初期値に戻せます。
3. **DETAIL** はWaveform / Detune / Octave / Oscillator Mix、ADSR、Filter Type / Cutoff / Resonance / Envelope Amount、LFO Rate / Depth / Destination / Vibrato、3帯域EQ / Compressor、Reverb / Delay / Feedback / Distortion / Chorus / Panを編集できます。数値・単位・範囲・初期値を表示します。フィルター、ピッチ、パンからLFOの割当先を選べます。
4. SIMPLE / DETAILは同じPresetStateを使います。切替だけでは値を変更しません。BODYとLENGTHは複数項目を上書きするため、DETAILで独立調整した後は必要なときだけ操作してください。**RESET** は選択した音色の状態へ戻します。
5. 割当先を **LEFT HIT（左手） / RIGHT HIT（右手） / MELODY（上辺・FREE PLAY）** から選び、**APPLY TO PLAYGROUND** を押します。左手・右手はその手のHIT音を置き換え、MELODYは上辺・FREE PLAYの音を置き換えます。両方を割り当てた上辺HITでは重ねて鳴ります。割当を解除すると元のジャンル音に戻ります。CLOSE後、**AUDIO ON** で演奏を再開してください。
6. 割当は現在のPlaygroundセッション内で保持し、ジャンル切替では消えません。ページ再読込後は保存した音色を再適用してください。BAND / TECHNO / AMBIENT / DUB / DUBSTEP / JUNGLE、THEREMIN、RHYTHM REACHは引き続き利用できます。
7. 名前を入力して **SAVE AS** でユーザー音色として保存します。**MY PRESETS** から選び、再読み込み・名前変更・複製・削除ができます。標準音色は上書きしません。localStorageはこのブラウザー・オリジン内の保存なので、バックアップには **EXPORT JSON** を使ってください。**IMPORT JSON** は新しいユーザーIDで取り込みます。

### 音源と制約

- 初期プリセットは **29種類、すべてSYNTH版（SYNTH 29 / SAMPLE 0 / HYBRID 0）** です。DRUMS 8、BASS 4、SYNTH 5、VOICE 4、INSTRUMENT 4、FX / NATURE 4。Acoustic Snare / Vocal Ah / Piano等も録音ではなく合成音のイメージ名です。リアルな録音音源やFM方式を装った名称は使用していません。
- ライセンス不明な録音素材は同梱していません。今回の公開版ではSAMPLE / HYBRIDは選択不可です。将来の録音素材追加用に音源方式、ローカル素材IDレジストリー、Playback Rate / Start Offset / Trim End / Reverse / Sample Gainの状態を分離して定義しています。実際の録音再生アダプターとライセンス確認済み素材は今後の追加対象です。未対応のSample Settingsは表示しません。
- JSONにはschemaVersionを含み、ID・カテゴリー・音源方式・列挙値・有限数・各範囲・トリム順序を検証します。未登録のサンプルIDを拒否し、JSON中の任意URLは音源として使用しません。
- 音声処理はTone.jsの既存コンテキストを利用し、プレビューはPlaygroundのTransportを変更しません。音色ごとに4音×2オシレーターまでのPolySynthとノイズ、専用エフェクト、Limiterを使用します。連続パラメーターには短いランプを適用し、停止・置換・画面離脱で音声と予約を解放します。PlaygroundのMaster / AUDIO OFFを経由するので割当音だけが鳴り続けることはありません。
- `src/sound-lab/types.ts` / `presets.ts` / `mapping.ts` / `storage.ts` / `audio.ts` はUI・手指追跡から独立しています。`LabVoice.setParameters()` は将来の手の位置・距離・速度等からの変更にも利用できます。MOTION MAPPINGそのものは今回の対象外です。

### 開発検証

`npm test` と `npm run build` を実行してください。開発サーバー上の `sound-lab-check.local.html` は、実Web Audioのオフラインレンダリングで全29音色の非ゼロ出力、27パラメーターの波形変化、STOP後の無音を検証します。`sound-lab-ui.local.html` は390px / 1280pxの実iframeビューポートで表示・操作を確認するためのページです。これらの検証ページは本番ビルドのエントリーには含めません。

実カメラによる追跡と実スピーカーの出音は未検証です。ブラウザー内の波形計測は実スピーカーでの聴感確認を代替しません。

## Phase 2 + 3: Duo Tracking / Rhythm Reach 2D

The default page now opens **RHYTHM REACH 2D**. **MUSIC PLAYGROUND** opens the original application at `?view=playground`; its camera lifecycle and music controls are retained.

1. Run `npm install` and `npm run dev`, then open the local URL in a camera-capable browser.
2. Choose SOLO or DUO (game modes CO-OP and BATTLE select DUO automatically).
3. Click START CAMERA. Allow camera access and wait for the two MediaPipe models to load.
4. In DUO, the person on the displayed left registers as blue P1; the person on the right registers as red P2. Raise both hands above the shoulders for a total of one second of valid detection (adjustable from 0.5 to 5.0 seconds). SOLO can instead register just L or R.
5. START becomes available once every required player has completed registration, and remains available through temporary tracking loss. Clicking it unlocks audio and starts the 3–2–1–START countdown.
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

Real-device acceptance remains necessary: test one and two people with all four hands, wrist crossing, short occlusion, person overlap and recalibration; switch between two physical cameras; deny camera permission; test model-download failure and CPU recovery; stop during model loading; compare mirror/background/skeleton toggles; and listen to beat alignment at 60 and 160 BPM. Pose and Hand inference now run sequentially on the same immutable ImageBitmap in one dedicated worker. Only one frame is in flight, with no queue; the next current video frame is captured when the worker becomes available (at most 20 submissions/second). The camera's full 960×540 requested resolution and four-hand limit are preserved. Rendering and audio scheduling remain on the main thread. Browser display, physical camera tracking and audible latency are not established by unit tests.

### Calibration / low-FPS fix (PR #11 follow-up)

- Confirmed code defects: the installed MediaPipe 0.10.35 converter supplies `visibility: 0` for hand landmarks without this optional field. The previous shared Pose/Hand visibility gate rejected these valid hands, and the drawing code also hid their skeletons. Hand coordinates now require finite X/Y; only Pose joints use visibility thresholds. The hand model is still called with `numHands: 4`; coordinates remain unmirrored until presentation, and assignment uses anatomical Pose wrists.
- A second defect reset the one-second hold on every interval over 250ms. Stable positive samples spaced 270ms apart now complete registration. The current cumulative hold accepts observation intervals up to 500ms and pauses on brief missing/ambiguous hands; longer gaps reset only unfinished progress. The 250ms freshness restriction on game HIT evidence remains; calibration tolerance does not fabricate HITs.
- LIVE TRACKING shows separate POSE FPS / HAND FPS, each model's measured inference duration, raw HAND DETECTION COUNT, per-hand assignment reasons, CALIBRATION PROGRESS, and the one-second hold requirement. Pose/Hand FPS are equal because both run once per submitted frame, measured over the completed-frame interval. Their durations are separate worker measurements; total INFERENCE additionally includes bitmap transfer/round-trip overhead.
- After ten seconds without completion, the UI displays the specific reason (no raw hands, invisible Pose wrist, ambiguous assignment, missing people, or no recent result). START remains disabled until every required player completes calibration; current tracking subsequently gates HIT only. Recalibration clears identity anchors, hold progress, elapsed time and diagnostics, and discards results captured before the reset.
- GPU initialization failures retain their diagnostic and fall back to CPU. Runtime exceptions name POSE or HAND; recovery explicitly chooses CPU rather than repeatedly recreating a failing GPU pipeline. Worker initialization times out at 60 seconds; a submitted inference times out at five seconds and terminates the worker. No exception is converted into an apparently successful zero-hand result.

The user's pre-fix observation was 4 render FPS / 4 track FPS and 206ms combined inference. That observation does not by itself establish why the model returned zero raw hands: the old display also replaced stale counts with zero. After this patch, compare raw HAND DETECTION COUNT with assigned hands and inspect the model-specific times/reasons. Real-camera SOLO/DUO detection, completion, loss/recovery and post-fix FPS must still be confirmed on the affected Windows Chrome device. During agent validation the camera request remained REQUESTING without a stream, so no post-fix real-camera speedup is claimed.

Development-only worker smoke check: open `/finger-symphony/worker-smoke.local.html` on the Vite dev server. It runs the real Pose/Hand models on twelve blank 960×540 frames without requesting a camera, then closes the worker. It is not included in the production entry points. One Windows browser run measured GPU rendering at 49.4 FPS and inference at 4.63 FPS including the 1,199ms first-frame warmup. The remaining eleven frames averaged Pose 73.4ms, Hand 52.5ms, and 126.5ms total round-trip (range 109.4–163.8ms). These measurements verify worker execution and rendering separation only; blank frames do not establish real-person detection accuracy or camera performance.

Pull requests to main run `npm ci`, `npm test`, and `npm run build` in Regression CI before merge; Deploy Pages publishes main after merge.

### Latched calibration and START

- Default HOLD is 1.0 seconds. Change **登録に必要な有効検出時間（秒）** within 0.5–5.0 seconds. SOLO uses L (LEFT), R (RIGHT), or BOTH; DUO requires both hands for each person. Shoulders and required hands must be visible, unambiguously assigned, and raised above the shoulders.
- Each player's hold accumulates monotonic capture timestamps (performance.now()), not frame counts. Only intervals between two positive observations, at most 500ms apart, count. Missing observations and the interval leading into recovery earn no time. Missing detections lasting at most 500ms preserve progress; longer missing periods or no-frame gaps reset unfinished progress. At 3 FPS, samples at 0, 333, 666, and 1000ms complete the default hold. Completion is reported on the next valid result, so inference/display latency may delay its visible appearance.
- P1 and P2 complete independently. Completed holds and registered pose/reach snapshots are fixed until an explicit reset. The UI displays per-player CALIBRATION: 0–100%, HOLD: elapsed / required sec, CALIBRATION COMPLETE, and current TRACKING: STABLE / UNSTABLE / LOST.
- START depends on completed registration, not instantaneous tracking. A session can start while hands are lowered/lost. Lost, ambiguous, stale, recovering, or over-250ms inference cannot score. Fresh stable observations resume HIT only after new outside-to-inside evidence; time/music continue during the pause. Person identity ambiguity or absence over 1.5 seconds still requires explicit recalibration before HIT can resume, but does not silently erase completion or disable START.
- Reset actions: recalibration, camera switch, SOLO/DUO change. Additional explicit resets are camera stop/new stream (the observed scene may change), CAMERA/DEMO input change (different provenance), selected-hand or hold-duration change (registration requirements change), and mirror change (initial P1/P2 display order and reach coordinates change). CO-OP/BATTLE switching and CPU model recovery retain completed registration. Opening DUO diagnostics resets only when changing SOLO to DUO.
- Session JSON records hold duration, loss grace, and the fixed registration poses. Reach uses these snapshots rather than a possibly lost pose at START; an occluded elbow uses the measured shoulder-to-wrist chord as a conservative reach instead of inventing a joint.

Real-camera acceptance for this change is not established by automated tests. Verify Windows Chrome SOLO LEFT/RIGHT/BOTH and DUO registration, brief loss, lowered hands after completion, START during loss, and HIT resumption after fresh stable tracking.

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

## Music Playground tracking / audio recovery

Open `?view=playground`, click **START CAMERA**, and separately click **AUDIO ON** to unlock browser audio. Camera permission alone does not enable sound. The header reports HANDS, inference time, tracking errors/fallback warnings, AudioContext state, Transport state, requested master volume/mute and edge HIT count. The footer reports measured render and inference FPS. **RECOVER HANDS** retries on CPU; camera video remains independent of model initialization failures.

Comparison with pre-PR #11 commit `a89bf45`: `src/tracking/hands.ts`, FaceTracker and dependency versions were unchanged. PR #11 added exclusive dynamic entry imports, Reach voices/methods, full engine disposal and pagehide cleanup. These additions did not reproduce a model failure in the blank-frame browser test. The following concrete defects were found and fixed without rolling back Reach:

- `src/main.ts` called `drawHand()` before `draw()` cleared the canvas, erasing both skeletons. Gesture processing now runs only on new inference results, while skeletons render after clearing on every draw frame. Cached hands expire after 500ms; missing hands reset crossing/contact state and stop theremin.
- `Hands.init()` previously had no initial GPU-to-CPU fallback. `recover()` first retried the failing GPU. Initial fallback, explicit CPU recovery, retained diagnostics, and cancellation of late initialization after stop/pagehide are now covered. Hand and Face WASM URLs match locked Tasks Vision 0.10.35 instead of moving `@latest`. Version drift is a preventive fix, not a reproduced cause on this device.
- The old inference catch also covered gesture/audio/face processing, misclassifying those failures as Hand failures. Diagnostics now separate model inference and performance/audio errors. Automatic model recovery is bounded; manual retry remains available.
- `MusicEngine.setEnabled()` overwrote user volume with 80% and could finish an asynchronous audio start after `dispose()`. It now preserves master volume/mute, cancels late starts, stops Transport/its pattern when disabled, and makes disposal idempotent. Reach entry points and its music API remain intact.

Both views continue to navigate as separate documents; bootstrap imports only the chosen view. Pagehide stops camera/models/microphone/animation/audio, and a persisted pageshow reloads rather than reviving disposed engines. The user must click camera/audio controls again after returning. Runtime camera loss and physical BFCache/device recovery still require device testing.

Development-only checks (not production entry points): `playground-smoke.local.html` runs real Hand initialization/inference on a blank image and a user-triggered Tone output-signal check. `playground-fixture.local.html` feeds clearly labeled synthetic Left/Right landmarks and a canvas stream through the real Playground UI to verify overlays and edge events. Neither proves real-hand detection. Browser validation found both synthetic skeletons, increasing HIT count, nonzero output RMS for all six genres and theremin, and zero RMS after master mute settled. Actual camera detection and physical speaker output were not available for verification; the exact cause of the reported device-specific total tracking loss remains unconfirmed.

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

## DRONE — 四辺で重ねるアンビエント演奏

Music Playgroundで **DRONE → AUDIO ON** を選び、フレームの辺に指を触れます。一度触れるとON、指を離してもう一度触れるとOFF。カメラなしでは各カードの **BOTTOM / TOP / LEFT / RIGHT TEST** が同じトグルを実行します。4レイヤーは独立して同時に鳴らせます。

| 辺 | 音楽レイヤー | プリセット |
|---|---|---|
| BOTTOM | 持続する低音・3オシレーター | Sine, Triangle, Saw, Sub Bass, Warm Drone, Dark Drone |
| TOP | 共通BPMのアルペジオ | Ascending, Descending, Up & Down, Random, Custom |
| LEFT | 環境音 | NATURE: Birds, Waterfall, Rain, Wind, Forest, Ocean / URBAN: Crowd, Street, Station, Cafe, Traffic |
| RIGHT | 編集可能なリズム | Minimal Pulse, Ambient Percussion, Soft Kick, Shaker, Wood Block, Metallic Percussion, Polyrhythm, Dub Percussion |

- **SIMPLE**: プリセット、音量、INFINITE / TIMED、Duration、Fade Out。**DETAIL**: Fade In、RETRIGGER、音源固有のパラメーターと4〜16ステップ編集。
- **INFINITE**は再接触まで持続。**TIMED**はDuration（1〜128拍）の経過後にFade Out（0〜32拍）を開始し、終了時にOFFへ戻ります。Fade Inは0〜16拍です。秒数は共通BPMに追従します。
- フェード中の再接触は **RESTART**（フェードを中断して再開）または **CANCEL**（停止）。通常の再接触／ALL OFFは設定したFade Outで停止、**PANIC STOP**は即時ミュートします。
- TOPとRIGHTは同じTone Transportの16分音符グリッドに同期します。ScaleはMajor / Minor / Pentatonic / Dorian / Phrygian / Chromatic。Customは各ステップの半音オフセット、ON/OFF、Velocityを使用します。RIGHTは各ステップでKick / Shaker / Percを選べます。Time Signatureは四分音符単位の拍子（例: 3 = 3/4）のアクセントに使用し、Stepsが反復長を決めます。
- LEFTの **SAMPLE / Rain** はOve Melaaの実録音（CC0）です。[出典・ライセンス](public/audio/drone/LICENSE.md)。その他は明示された **SYNTH** 近似音です。録音の取得／デコード失敗や未対応のSAMPLE選択でも合成環境音で演奏を継続できます。録音読込中に開始した合成音は、その演奏が終わるまで維持します。
- Crossfadeは録音のグレイン重なりを調整し、ループ境界を滑らかにします。Rate、Loopは録音用、フィルター・Reverb・Panは両方式に適用します。
- 接触距離／時間、Hand Frameを既存設定から使用します。全指・両手を辺単位で集約し、ヒステリシス、120msの解除確認、200ms以上のクールダウンを使用。追跡消失は解除扱いにせず、再び見えた指が離れたことを確認して再接触を許可します。追跡消失中もONの音は続きます。
- DRONEへの出入りはAUDIO OFFに戻ります。再度AUDIO ONで演奏してください。カメラ停止は全レイヤーを即時停止、AUDIO OFF・画面終了はスケジュールも解放します。既存ジャンル間の切替、SOUND LAB、THEREMIN、RHYTHM REACHは従来どおりです。
- 設定は専用localStorageキー `finger-symphony-drone-v1` に自動保存。**EXPORT JSON / IMPORT JSON**で全設定・ステップを移せます。再読込時は音のON状態を復元しません。SOUND LABのデータは変更しません。
- 出力値は実際の音声信号レベルです。実カメラ・実スピーカー・長時間の実機連続運転は別途確認が必要です。自動テストでは接触、状態遷移、同時レイヤー、共通クロック、終了処理、1万拍でのノード／イベント数を検証します。
