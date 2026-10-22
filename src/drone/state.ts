import type {LayerSettings} from './settings';
export class LayerState{
 phase:'OFF'|'ON'|'FADE'='OFF';started=0;fadeStart=0;fadeEnd=0;fadeLevel=1;
 level(beat:number,s:LayerSettings){if(this.phase==='OFF')return 0;if(this.phase==='FADE')return this.fadeLevel*Math.max(0,(this.fadeEnd-beat)/Math.max(.001,this.fadeEnd-this.fadeStart));return s.fadeIn?Math.min(1,Math.max(0,(beat-this.started)/s.fadeIn)):1}
 start(beat:number){this.phase='ON';this.started=beat}
 stop(beat:number,s:LayerSettings){if(this.phase==='OFF')return;this.fadeLevel=this.level(beat,s);this.fadeStart=beat;this.fadeEnd=beat+s.fadeOut;this.phase=s.fadeOut?'FADE':'OFF'}
 toggle(beat:number,s:LayerSettings){if(this.phase==='OFF'||this.phase==='FADE'&&s.retrigger==='RESTART')this.start(beat);else if(this.phase==='FADE')this.panic();else this.stop(beat,s)}
 update(beat:number,s:LayerSettings){if(this.phase==='ON'&&s.mode==='TIMED'&&beat>=this.started+s.duration)this.stop(this.started+s.duration,s);if(this.phase==='FADE'&&beat>=this.fadeEnd)this.panic()}
 panic(){this.phase='OFF'}
 remaining(beat:number,s:LayerSettings){return this.phase==='FADE'?Math.max(0,this.fadeEnd-beat):s.mode==='TIMED'?Math.max(0,this.started+s.duration-beat):Infinity}
}
