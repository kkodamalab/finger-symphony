import type { Point } from '../performance/frame';

export type CameraState='IDLE'|'REQUESTING'|'READY'|'ERROR';
export type TrackingState='IDLE'|'LOADING'|'READY'|'ERROR';
export type CameraReport={camera:CameraState;tracking:TrackingState;message?:string};

export const displayPointForCamera=(point:Point,mirrored:boolean):Point=>({x:mirrored?1-point.x:point.x,y:point.y});
export function setCameraPresentation(video:HTMLVideoElement,visible:boolean,mirrored:boolean){video.hidden=!visible;video.classList.toggle('mirrored',mirrored)}

type CameraSessionOptions={
  video:HTMLVideoElement;
  requestStream:(front:boolean)=>Promise<MediaStream>;
  initializeTracking:()=>Promise<void>;
  onReport:(report:CameraReport)=>void;
  onCameraReady:()=>void;
};

/** Owns camera acquisition separately from optional tracking initialization. */
export class CameraSession{
  private stream?:MediaStream;private pending?:Promise<void>;private generation=0;private visible=true;private mirrored=true;
  constructor(private options:CameraSessionOptions){}
  get active(){return Boolean(this.stream)}
  setPresentation(visible:boolean,mirrored=this.mirrored){this.visible=visible;this.mirrored=mirrored;setCameraPresentation(this.options.video,visible,mirrored)}
  start(front:boolean){
    if(this.pending)return this.pending;
    if(this.stream){this.setPresentation(this.visible,front);return Promise.resolve()}
    const generation=++this.generation;this.mirrored=front;
    const opening=this.open(front,generation);this.pending=opening.finally(()=>{if(this.pending===pending)this.pending=undefined});const pending=this.pending;
    return this.pending;
  }
  private async open(front:boolean,generation:number){
    this.options.onReport({camera:'REQUESTING',tracking:'IDLE'});
    try{
      const stream=await this.options.requestStream(front);
      if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return}
      this.stream=stream;this.options.video.srcObject=stream;this.setPresentation(this.visible,front);
      await this.options.video.play();
      if(generation!==this.generation){this.releaseStream();return}
      this.options.onReport({camera:'READY',tracking:'LOADING'});this.options.onCameraReady();
      try{await this.options.initializeTracking();if(generation===this.generation)this.options.onReport({camera:'READY',tracking:'READY'})}
      catch(error){if(generation===this.generation)this.options.onReport({camera:'READY',tracking:'ERROR',message:errorMessage(error)})}
    }catch(error){if(generation===this.generation){this.releaseStream();this.options.video.srcObject=null;this.options.onReport({camera:'ERROR',tracking:'IDLE',message:errorMessage(error)})}}
  }
  stop(){this.generation++;this.pending=undefined;this.releaseStream();this.options.video.pause();this.options.video.srcObject=null;this.options.onReport({camera:'IDLE',tracking:'IDLE'})}
  async switchCamera(front:boolean){this.stop();await this.start(front)}
  private releaseStream(){this.stream?.getTracks().forEach(track=>track.stop());this.stream=undefined}
}

const errorMessage=(error:unknown)=>error instanceof Error?error.message:String(error);
