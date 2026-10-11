import {DuoLandmarker} from './duo';
const model=new DuoLandmarker();
const scope=self as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(data:unknown)=>void;import:(url:string)=>Promise<void>;ModuleFactory:unknown};
// MediaPipe clears ModuleFactory after each task. ES module imports are cached,
// so explicitly restore the exported factory for Hand after Pose (and recovery).
scope.import=async url=>{const module=await import(/* @vite-ignore */url);scope.ModuleFactory=module.default};
scope.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      await model.init(data.delegate,true);
      scope.postMessage({type:'ready',delegate:model.delegate,warning:model.warning});
    }else if(data.type==='frame'){
      try{scope.postMessage({type:'result',frame:model.detect(data.image,data.timestamp)})}
      finally{data.image.close()}
    }
  }catch(error){scope.postMessage({type:'error',error:String(error)})}
};
