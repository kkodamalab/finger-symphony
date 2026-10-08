export type TempoReading={bpm:number;confidence:number};
type AudioContextLike={createMediaStreamSource(stream:MediaStream):{connect(node:AnalyserNode):void};createAnalyser():AnalyserNode;close():Promise<void>};

/** Owns exactly one microphone stream/context and makes source switching leak-free. */
export class MicrophoneTempoInput{
  private stream?:MediaStream;private context?:AudioContextLike;private frame?:number;private generation=0;
  constructor(private getStream=()=>navigator.mediaDevices.getUserMedia({audio:true}),private createContext=()=>new AudioContext() as AudioContextLike,private requestFrame=(callback:FrameRequestCallback)=>requestAnimationFrame(callback),private cancelFrame=(id:number)=>cancelAnimationFrame(id)){}
  get active(){return Boolean(this.stream||this.context)}
  async start(onReading:(reading:TempoReading)=>void){
    await this.stop();const generation=++this.generation;
    try{const stream=await this.getStream();if(generation!==this.generation){stream.getTracks().forEach(x=>x.stop());return}const context=this.createContext(),source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();source.connect(analyser);this.stream=stream;this.context=context;
      const data=new Uint8Array(analyser.fftSize),hits:number[]=[];let last=0;
      const poll=()=>{if(generation!==this.generation)return;analyser.getByteTimeDomainData(data);const level=data.reduce((sum,x)=>sum+Math.abs(x-128),0)/data.length,now=performance.now();if(level>12&&now-last>250){hits.push(now);last=now;if(hits.length>8)hits.shift();if(hits.length>3)onReading({bpm:60000/((hits.at(-1)!-hits[0])/(hits.length-1)),confidence:Math.min(.99,hits.length*.12)})}this.frame=this.requestFrame(poll)};poll();
    }catch(error){await this.stop();throw error}
  }
  async stop(){this.generation++;if(this.frame!==undefined)this.cancelFrame(this.frame);this.frame=undefined;this.stream?.getTracks().forEach(x=>x.stop());this.stream=undefined;const context=this.context;this.context=undefined;if(context)await context.close()}
}
