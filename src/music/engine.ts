import * as Tone from 'tone';
import type { Edge } from '../performance/frame';
import { MODES, type MusicMode, type Rhythm } from './modes';
import { chordForDegree, melodicIndex, PROGRESSIONS, SCALES, type ProgressionName, type ScaleName } from './theory';

export type HarmonyName='maj7'|'sus'|'minadd9';
export type EdgeEvent={edge:Edge;zone:number;velocity:number;direction:'in'|'out'};
export function harmonyForPhase(phase:number,current?:HarmonyName):HarmonyName{const p=Math.abs(phase),pad=12;if(current==='maj7'&&p<57)return current;if(current==='sus'&&p>33&&p<147)return current;if(current==='minadd9'&&p>123)return current;return p<45?'maj7':p>135?'minadd9':'sus'}

/** Tone.js orchestration is intentionally independent of camera/body input. */
export class MusicEngine{
  private limiter=new Tone.Limiter(-2).toDestination();private master=new Tone.Gain(.8).connect(this.limiter);
  private melodyGain=new Tone.Gain(.7).connect(this.master);private harmonyGain=new Tone.Gain(.45).connect(this.master);private bassGain=new Tone.Gain(.5).connect(this.master);private drumGain=new Tone.Gain(.55).connect(this.master);
  private delay=new Tone.FeedbackDelay({delayTime:'8n',feedback:.25,wet:1}).connect(this.master);private delaySend=new Tone.Gain(0).connect(this.delay);private reverb=new Tone.Reverb({decay:4,wet:1}).connect(this.master);private reverbSend=new Tone.Gain(.08).connect(this.reverb);
  private melody=new Tone.PolySynth(Tone.Synth).connect(this.melodyGain);
  private chords=[new Tone.PolySynth(Tone.Synth).connect(this.harmonyGain),new Tone.PolySynth(Tone.Synth).connect(this.harmonyGain)];
  private bass=new Tone.MonoSynth().connect(this.bassGain);private kick=new Tone.MembraneSynth().connect(this.drumGain);private noise=new Tone.NoiseSynth({volume:-14}).connect(this.drumGain);
  private texture=new Tone.NoiseSynth({volume:-22,envelope:{attack:1,release:3}}).connect(this.reverb);
  private scheduled?:number;private chord?:HarmonyName;private chordKey='';private bank=0;private step=0;private enabled=false;private accompaniment=true;
  mode:MusicMode='band';rhythm:Rhythm='8 beat';root='C';scale:ScaleName='major pentatonic';progression:ProgressionName='pop';experimental=false;quantize:'4n'|'8n'|'16n'|null='8n';bpm=100;
  constructor(){this.melody.connect(this.delaySend);this.melody.connect(this.reverbSend);this.chords.forEach(x=>x.connect(this.reverbSend))}
  async setEnabled(on:boolean){if(on){await Tone.start();Tone.getTransport().start()}this.enabled=on;this.master.gain.rampTo(on ? .8 : 0,.12);if(!on)this.stopVoices()}
  setMode(mode:MusicMode){this.stopVoices();this.mode=mode;const config=MODES[mode];this.rhythm=config.rhythm;this.bpm=config.bpm;this.quantize=config.quantize;this.progression=mode==='ambient'?'ambient':mode==='dub'?'dub':'pop';this.melody.set({oscillator:{type:mode==='techno'?'sawtooth':mode==='dub'?'square':'sine'}});this.delaySend.gain.rampTo(mode==='dub'?.3:0,.25);this.reverbSend.gain.rampTo(mode==='ambient'?.45:.08,.35);this.setTempo(config.bpm);this.restartPattern()}
  setTempo(bpm:number){this.bpm=Math.round(Math.max(40,Math.min(180,bpm)));Tone.getTransport().bpm.rampTo(this.bpm,2)}
  setAccompaniment(on:boolean){this.accompaniment=on;this.restartPattern()}
  setRhythm(rhythm:Rhythm){this.rhythm=rhythm;this.restartPattern()}
  setVolumes(master:number,melody:number,harmony:number){this.master.gain.rampTo(master,.1);this.melodyGain.gain.rampTo(melody,.1);this.harmonyGain.gain.rampTo(harmony,.1)}
  private restartPattern(){const transport=Tone.getTransport();if(this.scheduled!==undefined)transport.clear(this.scheduled);if(!this.accompaniment||this.rhythm==='free time')return;this.step=0;this.scheduled=transport.scheduleRepeat((time:number)=>this.tick(time),'8n')}
  private tick(time:number){if(!this.enabled)return;const even=this.step%2===0,beat=this.step%8;if((this.mode==='techno'&&even)||(this.mode==='band'&&beat%4===0)||(this.mode==='dub'&&(beat===0||beat===5)))this.kick.triggerAttackRelease('C1','8n',time,.6);if((this.mode==='techno'&&!even)||(this.mode==='band'&&(beat===2||beat===6))||(this.mode==='dub'&&beat===4))this.noise.triggerAttackRelease('16n',time,.25);if(even&&this.mode!=='ambient'){const degree=PROGRESSIONS[this.progression][Math.floor(this.step/8)%PROGRESSIONS[this.progression].length];this.bass.triggerAttackRelease(this.noteFromSemitone(SCALES[this.scale][degree%SCALES[this.scale].length]-12),'8n',time,.35)}this.step++}
  private eventTime(){return this.quantize?Tone.getTransport().nextSubdivision(this.quantize):undefined}
  private noteFromSemitone(semitone:number,octave=4){return Tone.Frequency(Tone.Frequency(this.root+octave).toMidi()+semitone,'midi').toNote()}
  note(index:number){return this.noteFromSemitone(SCALES[this.scale][index%SCALES[this.scale].length]+12*Math.floor(index/SCALES[this.scale].length),3)}
  handleEdge(event:EdgeEvent){if(!this.enabled)return'';const time=this.eventTime(),v=Math.min(.9,.25+event.velocity),degree=PROGRESSIONS[this.progression][Math.floor(this.step/8)%PROGRESSIONS[this.progression].length];
    if(event.edge==='bottom'){this.kick.triggerAttackRelease('C1','8n',time,v);const note=this.noteFromSemitone(melodicIndex(this.scale,degree,event.zone,this.experimental)-24);this.bass.triggerAttackRelease(note,'8n',time,v);return note}
    if(event.edge==='left'){this.noise.triggerAttackRelease(event.zone%2?'32n':'16n',time,v);if(this.mode==='ambient')this.texture.triggerAttackRelease(.8,time,v);return'PERC'}
    if(event.edge==='right'){if(this.mode==='dub'){this.delay.feedback.rampTo(Math.min(.62,.18+event.zone*.07),.2);return'DELAY'}const chord=chordForDegree(this.scale,degree,this.experimental).map(x=>this.noteFromSemitone(x));this.melody.triggerAttackRelease(chord,'8n',time,v);return'CHORD'}
    const semitone=melodicIndex(this.scale,degree,event.zone+8,this.experimental),note=this.noteFromSemitone(semitone);this.melody.triggerAttackRelease(note,this.mode==='ambient'?'2n':'8n',time,v);return note}
  setContinuous(edge:Edge,proximity:number,position:number){if(!this.enabled)return;if(this.mode==='ambient')this.reverbSend.gain.rampTo(.1+proximity*.55,.4);if(this.mode==='dub'&&edge==='right'){this.delaySend.gain.rampTo(proximity*.7,.25);this.delay.feedback.rampTo(Math.min(.62,.15+position*.45),.25)}}
  setCoordination(phase:number,stability:number,on=true){if(!this.enabled||!on)return;const name=harmonyForPhase(phase,this.chord),degree=PROGRESSIONS[this.progression][Math.floor(this.step/8)%PROGRESSIONS[this.progression].length],intervals=name==='maj7'?[0,4,7,11]:name==='sus'?[0,5,7,10]:[0,3,7,14],inversion=this.mode==='band'?Math.round(Math.abs(phase)/90):0,notes=intervals.map((n,i)=>this.noteFromSemitone(n+(i<inversion?12:0),3)),key=name+degree+this.root+this.mode;
    if(key!==this.chordKey){this.chords[this.bank].releaseAll(Tone.now()+.25);this.bank=1-this.bank;this.chords[this.bank].triggerAttack(notes,Tone.now()+.04,.28);this.chordKey=key;this.chord=name}const tension=1-stability;if(this.mode==='ambient')this.reverbSend.gain.rampTo(.2+tension*.5,.5);else if(this.mode==='techno')this.harmonyGain.gain.rampTo(.35+tension*.2,.4);else if(this.mode==='dub')this.delaySend.gain.rampTo(tension*.45,.4)}
  get harmonyName(){return this.chord?.toUpperCase()??'UNAVAILABLE'}
  stopVoices(){this.melody.releaseAll();this.chords.forEach(x=>x.releaseAll());this.bass.triggerRelease();this.texture.triggerRelease();this.chordKey='';this.chord=undefined}
}

export {MusicEngine as Music};
