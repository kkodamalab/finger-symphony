import * as Tone from 'tone';
import {validate,type PresetState,type Parameters} from './types';
import {previewNotes} from './presets';

/** A bounded voice bank, with an independent effects chain and the caller's master bus. */
export class LabVoice {
  private context=Tone.getContext();
  private output=new Tone.Gain(.65);
  private limiter=new Tone.Limiter(-6);
  private pan=new Tone.Panner(0);
  private reverb=new Tone.Reverb({decay:1.8,wet:0});
  private delay=new Tone.FeedbackDelay({delayTime:.15,feedback:.1,wet:.18});
  private chorus=new Tone.Chorus({frequency:1.5,delayTime:3.5,depth:.5,wet:0}).start();
  private drive=new Tone.Distortion(0);
  private compressor=new Tone.Compressor(-18,4);
  private eq=new Tone.EQ3(0,0,0);
  private vibrato=new Tone.Vibrato(5,0);
  private pitchLfo=new Tone.Vibrato(2,0);
  private filter=new Tone.Filter(4000,'lowpass');
  private toneGain=new Tone.Gain(1);
  private secondGain=new Tone.Gain(.25);
  private noiseGain=new Tone.Gain(0);
  private first=new Tone.PolySynth(Tone.MonoSynth,{volume:-6});
  private second=new Tone.PolySynth(Tone.MonoSynth,{volume:-10});
  private noise=new Tone.NoiseSynth({volume:-6});
  private lfo=new Tone.LFO({frequency:2,min:4000,max:4000}).start();
  private state:PresetState;
  private closed=false;private lfoConnected=false;private scheduled=new Set<number>();
  constructor(p:PresetState,destination?:Tone.ToneAudioNode){
    this.state=validate(p);this.first.maxPolyphony=4;this.second.maxPolyphony=4;
    this.first.connect(this.toneGain);this.second.connect(this.secondGain);this.noise.connect(this.noiseGain);
    this.toneGain.connect(this.filter);this.secondGain.connect(this.filter);this.noiseGain.connect(this.filter);
    this.filter.chain(this.pitchLfo,this.vibrato,this.eq,this.compressor,this.drive,this.chorus,this.delay,this.reverb,this.pan,this.limiter,this.output);
    if(destination)this.output.connect(destination);else this.output.toDestination();
    this.update(p);
  }
  /** Also available to future motion mapping; validation is identical to UI edits. */
  setParameters(patch:Partial<Parameters>){this.update({...this.state,params:{...this.state.params,...patch}})}
  update(value:PresetState){
    if(this.closed)return;const s=validate(value);if(s.source!=='SYNTH')throw Error('この版には録音サンプルを同梱していません');
    const p=s.params,old=this.state.params;this.state=s;
    const envelope={attack:p.attack,decay:p.decay,sustain:p.sustain,release:p.release};
    this.first.set({oscillator:{type:p.waveform},detune:p.detune,envelope,filter:{type:p.filterType,Q:p.resonance},filterEnvelope:{...envelope,baseFrequency:p.cutoff,octaves:p.filterAmount}});
    this.second.set({oscillator:{type:p.waveform},detune:-p.detune,envelope,filter:{type:p.filterType,Q:p.resonance},filterEnvelope:{...envelope,baseFrequency:p.cutoff,octaves:p.filterAmount}});
    this.noise.set({envelope});this.toneGain.gain.rampTo(1-s.noiseMix,.04);this.secondGain.gain.rampTo(p.mix*(1-s.noiseMix),.04);this.noiseGain.gain.rampTo(s.noiseMix,.04);
    this.filter.type=p.filterType;this.filter.Q.rampTo(p.resonance,.04);
    // Reconnect only on destination changes; continuous edits use AudioParam ramps.
    if(old.lfoDestination!==p.lfoDestination||!this.lfoConnected){this.lfo.disconnect();this.filter.frequency.value=p.cutoff;this.pan.pan.value=p.pan;this.lfo.connect(p.lfoDestination==='pan'?this.pan.pan:this.filter.frequency);this.lfoConnected=true}
    this.lfo.frequency.rampTo(p.lfoRate,.04);
    if(p.lfoDestination==='pan'){this.lfo.min=Math.max(-1,p.pan-p.lfoDepth);this.lfo.max=Math.min(1,p.pan+p.lfoDepth);this.filter.frequency.rampTo(p.cutoff,.04)}
    else {const depth=p.lfoDestination==='filter'?p.lfoDepth:0;this.lfo.min=Math.max(40,p.cutoff*(1-depth*.95));this.lfo.max=Math.min(20000,p.cutoff*(1+depth));this.pan.pan.rampTo(p.pan,.04)}
    this.pitchLfo.frequency.rampTo(p.lfoRate,.04);this.pitchLfo.depth.rampTo(p.lfoDestination==='pitch'?p.lfoDepth:0,.04);
    this.vibrato.depth.rampTo(p.vibrato/100,.04);
    this.eq.low.rampTo(p.low,.04);this.eq.mid.rampTo(p.mid,.04);this.eq.high.rampTo(p.high,.04);
    this.compressor.threshold.rampTo(p.threshold,.04);this.compressor.ratio.rampTo(p.ratio,.04);
    this.drive.distortion=p.distortion;this.chorus.wet.rampTo(p.chorus,.04);this.reverb.wet.rampTo(p.reverb,.04);this.delay.delayTime.rampTo(p.delay,.04);this.delay.feedback.rampTo(p.feedback,.04);
  }
  hit(midi:number,duration=.2,time=this.context.now(),velocity=.6){
    if(this.closed)return;
    if(![midi,duration,time,velocity].every(Number.isFinite))throw Error('不正な音声イベント');
    // Keep future quantized hits cancellable, instead of queuing unrevocable synth attacks.
    const delay=time-this.context.now();if(delay>.005){if(this.scheduled.size>=32)return;const id=this.context.setTimeout(()=>{this.scheduled.delete(id);this.hit(midi,duration,this.context.now(),velocity)},delay);this.scheduled.add(id);return}
    const p=this.state.params,note=Tone.Frequency(Math.max(0,Math.min(127,midi+p.octave*12)),'midi').toFrequency(),v=Math.max(.01,Math.min(.8,velocity));this.output.gain.rampTo(.65,.015);this.first.triggerAttackRelease(note,Math.max(.01,Math.min(5,duration)),time,v);this.second.triggerAttackRelease(note*2,Math.max(.01,Math.min(5,duration)),time,v);if(this.state.noiseMix)this.noise.triggerAttackRelease(Math.max(.01,Math.min(5,duration)),time,v)
  }
  stop(){if(this.closed)return;this.scheduled.forEach(id=>this.context.clearTimeout(id));this.scheduled.clear();this.first.releaseAll();this.second.releaseAll();this.noise.triggerRelease();this.output.gain.rampTo(0,.025)}
  dispose(){if(this.closed)return;this.stop();this.closed=true;[this.first,this.second,this.noise,this.toneGain,this.secondGain,this.noiseGain,this.filter,this.pitchLfo,this.vibrato,this.eq,this.compressor,this.drive,this.chorus,this.delay,this.reverb,this.pan,this.limiter,this.output,this.lfo].forEach(n=>n.dispose())}
}

/** Uses cancellable wall-clock callbacks, never adds events to Playground's transport. */
export class Preview {
  private generation=0;private timers:ReturnType<typeof setTimeout>[]=[];private voice?:LabVoice;private closed=false;private pending?:PresetState;
  async play(p:PresetState){this.stop();if(this.closed)return;this.pending=validate(p);const generation=this.generation;await Tone.start();if(this.closed||generation!==this.generation)return;const current=this.pending!;this.voice=new LabVoice(current);const notes=previewNotes(current.category),duration=current.category==='FX / NATURE'?1.2:current.category==='DRUMS'?.08:.24;notes.forEach((note,i)=>this.timers.push(setTimeout(()=>{if(generation===this.generation)this.voice?.hit(note,duration)},i*360)));this.timers.push(setTimeout(()=>this.stop(),notes.length*360+(duration+5+3)*1000))}
  update(p:PresetState){if(this.pending)this.pending=validate(p);this.voice?.update(p)}
  stop(){this.generation++;this.pending=undefined;this.timers.forEach(clearTimeout);this.timers=[];this.voice?.dispose();this.voice=undefined}
  dispose(){this.stop();this.closed=true}
}
