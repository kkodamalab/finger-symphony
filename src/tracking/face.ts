import{FaceLandmarker,FilesetResolver}from'@mediapipe/tasks-vision';
export class FaceTracker{
  private landmarker?:FaceLandmarker;private lastAt=-Infinity;
  async start(){if(this.landmarker)return;const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');this.landmarker=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numFaces:1})}
  detectNoseY(video:HTMLVideoElement,now:number){if(!this.landmarker||now-this.lastAt<100)return;this.lastAt=now;return this.landmarker.detectForVideo(video,now).faceLandmarks[0]?.[1]?.y}
  stop(){this.landmarker?.close();this.landmarker=undefined;this.lastAt=-Infinity}
}
