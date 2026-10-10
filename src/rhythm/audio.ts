import * as Tone from 'tone';
import {MusicEngine} from '../music/engine';
import type {MusicMode} from '../music/modes';

/** Rhythm and FREE PLAY load exclusively; both use Tone's singleton context. */
export class RhythmAudio {
  private engine?:MusicEngine;
  private context?:AudioContext;
  private origin=0;
  private generation=0;
  private volume=.65;
  private muted=false;
  async start(bpm:number,_duration:number,mode:MusicMode='band'){
    this.stop();const generation=this.generation;await Tone.start();
    if(generation!==this.generation)return;
    this.context=Tone.getContext().rawContext as AudioContext;
    if(this.context.state!=='running')throw new Error('音声を開始できません。STARTを再度押してください。');
    this.engine??=new MusicEngine();this.origin=this.context.currentTime+3.25;
    this.engine.beginReach(mode,bpm,this.origin);this.engine.reachVolume(this.volume,this.muted);
  }
  setVolume(volume:number,muted:boolean){this.volume=volume;this.muted=muted;this.engine?.reachVolume(volume,muted)}
  hit(player:'P1'|'P2',grade:string){this.engine?.reachHit(player,grade)}
  get running(){return this.context?.state==='running'}
  at(performanceTime:number){
    if(!this.context)return -Infinity;
    const stamp=this.context.getOutputTimestamp?.();
    const audioTime=stamp&&stamp.performanceTime!==undefined&&stamp.contextTime!==undefined&&stamp.performanceTime>0?stamp.contextTime+(performanceTime-stamp.performanceTime)/1000:this.context.currentTime+(performanceTime-performance.now())/1000-(this.context.outputLatency||this.context.baseLatency||0);
    return (audioTime-this.origin)*1000;
  }
  now(){return this.at(performance.now())}
  stop(){this.generation++;this.engine?.stopReach()}
  close(){this.stop();this.engine?.dispose();this.engine=undefined;this.context=undefined}
}
