import type {RawFrame} from './duo';

/** One in-flight bitmap, no frame queue. Worker keeps inference off the render/audio thread. */
export class DuoClient {
  private worker?:Worker;
  private pending?:{resolve:(data:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
  private generation=0;
  busy=false;
  delegate:'GPU'|'CPU'='GPU';
  warning='';
  async init(preferred:'GPU'|'CPU'='GPU'){
    this.close();const generation=this.generation;
    this.worker=new Worker(new URL('./duo.worker.ts',import.meta.url),{type:'module'});
    this.worker.onmessage=({data})=>{if(generation!==this.generation)return;const pending=this.pending;if(!pending)return;clearTimeout(pending.timer);this.pending=undefined;data.type==='error'?pending.reject(new Error(data.error)):pending.resolve(data)};
    this.worker.onerror=event=>{if(generation!==this.generation)return;const pending=this.pending;if(pending){clearTimeout(pending.timer);this.pending=undefined;pending.reject(new Error(`WORKER: ${event.message}`))}};
    try{const ready=await this.request({type:'init',delegate:preferred},60000);if(generation===this.generation){this.delegate=ready.delegate;this.warning=ready.warning}}
    catch(error){if(generation===this.generation)this.close();throw error}
  }
  private request(data:unknown,timeout:number,transfer:Transferable[]=[]):Promise<any>{
    return new Promise((resolve,reject)=>{
      if(!this.worker){reject(new Error('追跡Workerが起動していません'));return}
      const timer=setTimeout(()=>{this.pending=undefined;this.worker?.terminate();this.worker=undefined;reject(new Error(`WORKER TIMEOUT (${timeout}ms) — 推論を停止しました`))},timeout);
      this.pending={resolve,reject,timer};
      try{this.worker.postMessage(data,transfer)}catch(error){clearTimeout(timer);this.pending=undefined;reject(error)}
    });
  }
  async detect(video:HTMLVideoElement,timestamp:number):Promise<RawFrame|undefined>{
    if(this.busy||!this.worker)return;
    this.busy=true;const generation=this.generation;let image:ImageBitmap|undefined;
    try{
      // Keep camera resolution: small hands must not be downsampled further.
      image=await createImageBitmap(video);
      if(generation!==this.generation){image.close();return}
      const result=await this.request({type:'frame',image,timestamp},5000,[image]);
      return generation===this.generation?result.frame:undefined;
    }catch(error){image?.close();throw error}
    finally{if(generation===this.generation)this.busy=false}
  }
  close(){this.generation++;this.worker?.terminate();this.worker=undefined;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(new Error('追跡処理をリセットしました'));this.pending=undefined}this.busy=false}
}
