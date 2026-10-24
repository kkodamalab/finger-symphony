import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Landmark } from "./contact";
/** One pose inference per video frame, capped at 15Hz and adaptive to inference cost. */
export class BodyPose {
  model?: PoseLandmarker;
  error = "";
  inferenceMs = 0;
  private generation = 0;
  private last = -Infinity;
  private videoTime = -1;
  async init() {
    this.close();
    const gen = this.generation;
    try {
      const files = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      for (const delegate of ["GPU", "CPU"] as const) {
        if (gen !== this.generation) return;
        try {
          const model = await PoseLandmarker.createFromOptions(files, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate,
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6,
          });
          if (gen !== this.generation) {
            model.close();
            return;
          }
          this.model = model;
          this.error = "";
          return;
        } catch (e) {
          if (delegate === "CPU") throw e;
        }
      }
    } catch (e) {
      if (gen === this.generation) this.error = String(e);
      throw e;
    }
  }
  detect(video: HTMLVideoElement, t: number): Landmark[] | undefined {
    if (
      !this.model ||
      video.currentTime === this.videoTime ||
      t - this.last < Math.max(1000 / 15, this.inferenceMs * 2)
    )
      return;
    this.last = t;
    this.videoTime = video.currentTime;
    const start = performance.now();
    try {
      const result = this.model.detectForVideo(video, t);
      this.error = "";
      return result.landmarks[0] ?? [];
    } catch (e) {
      this.error = String(e);
      return [];
    } finally {
      this.inferenceMs = performance.now() - start;
    }
  }
  close() {
    this.generation++;
    this.model?.close();
    this.model = undefined;
    this.last = -Infinity;
    this.videoTime = -1;
  }
}
