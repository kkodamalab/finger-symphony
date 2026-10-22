import * as Tone from 'tone';
import type {Edge} from '../performance/frame';
import {EDGES,type Settings,validate} from './settings';
import {LayerState} from './state';
import {BassDroneLayer,ArpeggioLayer,FieldRecordingLayer,PercussionLayer,type Layer} from './layers';
export class DroneEngine{
 settings:Settings;readonly states=Object.fromEntries(EDGES.map(e=>[e,new LayerState()])) as Record<Edge,LayerState>;
 private meter=new Tone.Meter({normalRange:true,smoothing:.7});private limiter=new Tone.Limiter(-3).toDestination();private master=new Tone.Gain(0).connect(this.limiter);private gains=Object.fromEntries(EDGES.map(e=>[e,new Tone.Gain(0).connect(this.master)])) as Record<Edge,Tone.Gain>;
 private layers:Record<Edge,Layer>;private running=new Set<Edge>();private origins={} as Record<Edge,number>;private scheduled?:number;private enabled=false;private disposed=false;private generation=0;private lastStep=-1;
 constructor(settings:Settings){this.settings=validate(settings);this.master.connect(this.meter);this.layers={bottom:new BassDroneLayer(this.gains.bottom),top:new ArpeggioLayer(this.gains.top),left:new FieldRecordingLayer(this.gains.left),right:new PercussionLayer(this.gains.right)};this.configure(this.settings)}
 get beat(){const t=Tone.getTransport();return t.ticks/t.PPQ}
 get diagnostics(){const value=this.meter.getValue();return{peak:Array.isArray(value)?Math.max(...value):value,enabled:this.enabled,schedules:this.scheduled===undefined?0:1,active:this.running.size,field:(this.layers.left as FieldRecordingLayer).source,sample:(this.layers.left as FieldRecordingLayer).sampleStatus}}
 configure(settings:Settings){this.settings=validate(settings);if(this.enabled){Tone.getTransport().bpm.value=this.settings.bpm;this.master.gain.rampTo(this.settings.master,.08)}EDGES.forEach(e=>this.layers[e].configure(this.settings.layers[e],this.settings))}
 async setEnabled(on:boolean){const gen=++this.generation;if(this.disposed)return;if(!on){this.enabled=false;this.lastStep=-1;this.panic();if(this.scheduled!==undefined)Tone.getTransport().clear(this.scheduled);this.scheduled=undefined;this.master.gain.cancelScheduledValues(0);this.master.gain.value=0;return}await Tone.start();if(this.disposed||gen!==this.generation)return;this.enabled=true;this.configure(this.settings);const transport=Tone.getTransport();if(this.scheduled===undefined)this.scheduled=transport.scheduleRepeat(time=>this.tick(time),'64n');transport.start()}
 toggle(edge:Edge){if(!this.enabled||this.disposed)return;if(this.states[edge].phase==='FADE'&&this.settings.layers[edge].retrigger==='RESTART'&&this.running.delete(edge))this.layers[edge].stop(Tone.now());this.states[edge].toggle(this.beat,this.settings.layers[edge]);this.sync(edge,Tone.now(),this.beat)}
 allOff(){EDGES.forEach(e=>this.states[e].stop(this.beat,this.settings.layers[e]))}
 panic(){EDGES.forEach(e=>{this.states[e].panic();this.gains[e].gain.cancelScheduledValues(0);this.gains[e].gain.setValueAtTime(0,Tone.immediate());if(this.running.has(e))this.layers[e].stop(Tone.now())});this.running.clear()}
 private sync(e:Edge,time:number,beat:number){const state=this.states[e],s=this.settings.layers[e];if(this.layers[e].finished?.())state.panic();state.update(beat,s);if(state.phase==='OFF'){if(this.running.delete(e))this.layers[e].stop(time)}else if(!this.running.has(e)){this.origins[e]=Math.ceil(beat*4-1e-5);this.layers[e].start(time);this.running.add(e)}this.gains[e].gain.rampTo(state.level(beat,s)*s.volume,.015,time)}
 private tick(time:number){if(!this.enabled)return;const transport=Tone.getTransport(),beat=transport.getTicksAtTime(time)/transport.PPQ;EDGES.forEach(e=>this.sync(e,time,beat));const step=Math.floor(beat*4+1e-5);if(step!==this.lastStep){this.lastStep=step;EDGES.forEach(e=>{if(this.states[e].phase!=='OFF'&&step>=this.origins[e])this.layers[e].tick(step-this.origins[e],time)})}}
 dispose(){if(this.disposed)return;void this.setEnabled(false);this.disposed=true;Object.values(this.layers).forEach(l=>l.dispose());[...Object.values(this.gains),this.master,this.limiter,this.meter].forEach(n=>n.dispose())}
}
