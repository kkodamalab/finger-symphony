import {FilesetResolver,HandLandmarker} from '@mediapipe/tasks-vision';
export type Hand={side:'Left'|'Right';points:{x:number;y:number;z:number}[]};

export class Hands {
  landmarker?:HandLandmarker;
  delegate:'GPU'|'CPU'='GPU';
  private vision?:Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
  private lastDetectAt=0;
  private readonly intervalMs=1000/30;

  async init(delegate:'GPU'|'CPU'='GPU'){
    this.close();
    this.delegate=delegate;
    this.vision??=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
    this.landmarker=await HandLandmarker.createFromOptions(this.vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:2});
    this.lastDetectAt=0;
  }

  detect(video:HTMLVideoElement,t:number):Hand[]|undefined{
    if(!this.landmarker||t-this.lastDetectAt<this.intervalMs)return undefined;
    this.lastDetectAt=t;
    const r=this.landmarker.detectForVideo(video,t);
    return r.landmarks.map((points,i)=>({points,side:(r.handedness[i]?.[0]?.categoryName as 'Left'|'Right')||'Left'}));
  }

  async recover(){
    try{await this.init(this.delegate)}
    catch(error){if(this.delegate==='GPU')await this.init('CPU');else throw error}
  }

  close(){this.landmarker?.close();this.landmarker=undefined}
}
