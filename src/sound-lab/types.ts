export const categories = ['DRUMS','BASS','SYNTH','VOICE','INSTRUMENT','FX / NATURE'] as const;
export type Category = typeof categories[number];
export type Target = 'left' | 'right' | 'melody';
export const numeric = {
  detune: [-100,100,1,0,'cent','OSCILLATOR'], octave: [-3,3,1,0,'oct','OSCILLATOR'], mix: [0,1,.01,.25,'','OSCILLATOR'],
  attack: [.001,2,.001,.01,'s','AMPLITUDE ENVELOPE'], decay: [.01,3,.01,.3,'s','AMPLITUDE ENVELOPE'], sustain: [0,1,.01,.4,'','AMPLITUDE ENVELOPE'], release: [.01,5,.01,.5,'s','AMPLITUDE ENVELOPE'],
  cutoff: [40,16000,1,4000,'Hz','FILTER'], resonance: [.1,12,.1,1,'Q','FILTER'], filterAmount: [0,4,.01,1,'oct','FILTER'],
  lfoRate: [.1,20,.1,2,'Hz','MODULATION'], lfoDepth: [0,1,.01,0,'','MODULATION'], vibrato: [0,100,1,0,'%','MODULATION'],
  low: [-18,12,.1,0,'dB','EQ / DYNAMICS'], mid: [-18,12,.1,0,'dB','EQ / DYNAMICS'], high: [-18,12,.1,0,'dB','EQ / DYNAMICS'], threshold: [-60,0,1,-18,'dB','EQ / DYNAMICS'], ratio: [1,20,.1,4,':1','EQ / DYNAMICS'],
  reverb: [0,.8,.01,.12,'wet','EFFECTS'], delay: [0,1,.01,.15,'s','EFFECTS'], feedback: [0,.75,.01,.1,'','EFFECTS'], distortion: [0,.8,.01,0,'','EFFECTS'], chorus: [0,1,.01,0,'wet','EFFECTS'], pan: [-1,1,.01,0,'L/R','EFFECTS'],
  playbackRate: [.25,4,.01,1,'×','SAMPLE SETTINGS'], start: [0,.99,.01,0,'fraction','SAMPLE SETTINGS'], end: [.01,1,.01,1,'fraction','SAMPLE SETTINGS'], sampleGain: [0,1,.01,.5,'','SAMPLE SETTINGS'],
} as const;
export type NumericKey = keyof typeof numeric;
export type Parameters = Record<NumericKey,number> & {waveform:'sine'|'triangle'|'sawtooth'|'square'; filterType:'lowpass'|'highpass'|'bandpass'; lfoDestination:'filter'|'pitch'|'pan'; reverse:boolean};
export interface PresetState {schemaVersion:1; id:string; name:string; category:Category; source:'SYNTH'|'SAMPLE'|'HYBRID'; texture:'tone'|'noise'; noiseMix:number; sampleId?:string; params:Parameters}
export const defaults = {...Object.fromEntries(Object.entries(numeric).map(([key,spec])=>[key,spec[3]])),waveform:'sine',filterType:'lowpass',lfoDestination:'filter',reverse:false} as Parameters;
/** Only reviewed, bundled recordings may be added here. JSON never supplies URLs. */
export const sampleAssets:Record<string,{url:string;license:string}> = {};
export function clone(p:PresetState):PresetState {return structuredClone(p)}
export function validate(value:unknown):PresetState {
  if(!value||typeof value!=='object')throw Error('プリセット形式が不正です');
  const p=value as PresetState;
  if(p.schemaVersion!==1||typeof p.id!=='string'||! /^(builtin|user)-[a-zA-Z0-9-]{1,80}$/.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!categories.includes(p.category))throw Error('バージョン・ID・名前・カテゴリーが不正です');
  if(!['SYNTH','SAMPLE','HYBRID'].includes(p.source)||!['tone','noise'].includes(p.texture)||!Number.isFinite(p.noiseMix)||p.noiseMix<0||p.noiseMix>1)throw Error('音源方式が不正です');
  if(p.source!=='SYNTH'&&(!p.sampleId||!Object.hasOwn(sampleAssets,p.sampleId)))throw Error('信頼済みのローカルサンプルが必要です');
  if(!p.params||typeof p.params!=='object')throw Error('パラメーターがありません');
  for(const [key,[min,max]] of Object.entries(numeric)){const v=p.params[key as NumericKey];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${key}: ${min}〜${max}の範囲で指定してください`)}
  if(!['sine','triangle','sawtooth','square'].includes(p.params.waveform)||!['lowpass','highpass','bandpass'].includes(p.params.filterType)||!['filter','pitch','pan'].includes(p.params.lfoDestination)||typeof p.params.reverse!=='boolean'||p.params.start>=p.params.end)throw Error('選択値またはサンプル範囲が不正です');
  // Reconstruct known fields: reject executable content by never retaining URLs or arbitrary keys.
  return {schemaVersion:1,id:p.id,name:p.name.trim(),category:p.category,source:p.source,texture:p.texture,noiseMix:p.noiseMix,...(p.source!=='SYNTH'?{sampleId:p.sampleId}:{}),params:{...Object.fromEntries(Object.keys(numeric).map(k=>[k,p.params[k as NumericKey]])),waveform:p.params.waveform,filterType:p.params.filterType,lfoDestination:p.params.lfoDestination,reverse:p.params.reverse} as Parameters};
}
