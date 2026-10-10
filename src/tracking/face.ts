import {FaceLandmarker,FilesetResolver} from '@mediapipe/tasks-vision';
export class FaceTracker{
 private landmarker?:FaceLandmarker;private lastAt=-Infinity;
 async start(){if(this.landmarker)return;const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');this.landmarker=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1})}
 detect(video:HTMLVideoElement,t:number):number|undefined{if(!this.landmarker||t-this.lastAt<100)return;this.lastAt=t;const face=this.landmarker.detectForVideo(video,t).faceLandmarks[0];return face?.[1]?.y}
 stop(){this.landmarker?.close();this.landmarker=undefined;this.lastAt=-Infinity}
}
