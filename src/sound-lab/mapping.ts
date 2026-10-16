import {clone,type PresetState} from './types';
export const macros={brightness:'音の明るさ',body:'音の太さ',attack:'音の立ち上がり',length:'音の長さ',space:'響き・広がり',character:'音の粗さ・歪み'};
export type Macro=keyof typeof macros;
export function readMacro(s:PresetState,key:Macro){const p=s.params;return Math.round(Math.max(0,Math.min(100,({brightness:Math.log(p.cutoff/40)/Math.log(400)*100,body:(p.low+18)/30*100,attack:(p.attack-.001)/1.999*100,length:(p.release-.01)/4.99*100,space:p.reverb/.8*100,character:p.distortion/.8*100})[key])))}
/** Mode changes never call this. Only an explicit macro edit changes mapped fields. */
export function setMacro(s:PresetState,key:Macro,value:number){const next=clone(s),p=next.params,v=Math.max(0,Math.min(100,value))/100;if(!Number.isFinite(v))throw Error('不正な値');switch(key){case 'brightness':p.cutoff=40*400**v;break;case 'body':p.low=-18+30*v;p.mix=v;break;case 'attack':p.attack=.001+1.999*v;break;case 'length':p.decay=.01+2.99*v;p.release=.01+4.99*v;break;case 'space':p.reverb=.8*v;break;case 'character':p.distortion=.8*v;break}return next}
