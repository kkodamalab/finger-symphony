import {FilesetResolver,HandLandmarker} from '@mediapipe/tasks-vision';
export type Hand={side:'Left'|'Right';points:{x:number;y:number;z:number}[]};

export class Hands {
  landmarker?:HandLandmarker;
  delegate:'GPU'|'CPU'='GPU';
  warning='';
  error='';
  inferenceMs=0;
  count=0;
  private generation=0;
  private vision?:Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
  private lastDetectAt=0;
  private readonly intervalMs=1000/30;

  async init(delegate:'GPU'|'CPU'='GPU'){
    this.close();
    const generation=this.generation;this.warning='';this.error='';
    try{
      this.vision??=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
      for(const candidate of (delegate==='GPU'?['GPU','CPU']:['CPU']) as ('GPU'|'CPU')[]){
        if(generation!==this.generation)return;
        try{
          const model=await HandLandmarker.createFromOptions(this.vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:candidate},runningMode:'VIDEO',numHands:2});
          if(generation!==this.generation){model.close();return}
          this.landmarker=model;this.delegate=candidate;this.lastDetectAt=-Infinity;return;
        }catch(error){if(generation!==this.generation)return;this.warning=`${candidate} initialization: ${String(error)}`;if(candidate==='CPU')throw error}
      }
    }catch(error){if(generation===this.generation)this.error=String(error);throw error}
  }

  detect(video:HTMLVideoElement,t:number):Hand[]|undefined{
    if(!this.landmarker||t-this.lastDetectAt<this.intervalMs)return undefined;
    this.lastDetectAt=t;
    const start=performance.now();
    try{
      const r=this.landmarker.detectForVideo(video,t);this.count=r.landmarks.length;this.error='';
      return r.landmarks.map((points,i)=>({points,side:(r.handedness[i]?.[0]?.categoryName as 'Left'|'Right')||'Left'}));
    }catch(error){this.count=0;this.error=`HAND inference (${this.delegate}): ${String(error)}`;throw new Error(this.error)}
    finally{this.inferenceMs=performance.now()-start}
  }

  async recover(){
    await this.init('CPU');
  }

  close(){this.generation++;this.landmarker?.close();this.landmarker=undefined;this.count=0;this.lastDetectAt=-Infinity}
}
