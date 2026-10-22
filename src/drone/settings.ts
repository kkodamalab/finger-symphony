import type {Edge} from '../performance/frame';
export const EDGES:Edge[]=['bottom','top','left','right'];
export const ROLES:Record<Edge,string>={bottom:'BASS DRONE',top:'MINIMAL ARPEGGIO',left:'FIELD RECORDING',right:'RHYTHM / PERCUSSION'};
export const ROOTS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const SCALES:Record<string,number[]>={Major:[0,2,4,5,7,9,11],Minor:[0,2,3,5,7,8,10],Pentatonic:[0,2,4,7,9],Dorian:[0,2,3,5,7,9,10],Phrygian:[0,1,3,5,7,8,10],Chromatic:Array.from({length:12},(_,i)=>i)};
export const PRESETS:Record<Edge,string[]>={bottom:['Sine','Triangle','Saw','Sub Bass','Warm Drone','Dark Drone'],top:['Ascending','Descending','Up & Down','Random','Custom'],left:['Rain','Birds','Waterfall','Wind','Forest','Ocean','Crowd','Street','Station','Cafe','Traffic'],right:['Minimal Pulse','Ambient Percussion','Soft Kick','Shaker','Wood Block','Metallic Percussion','Polyrhythm','Dub Percussion']};
export type Step={on:boolean;note:number;velocity:number;kit:number};
export type LayerSettings={preset:string;volume:number;mode:'INFINITE'|'TIMED';duration:number;fadeIn:number;fadeOut:number;retrigger:'RESTART'|'CANCEL';octave:number;cutoff:number;resonance:number;attack:number;release:number;detune:number;width:number;sub:number;octaves:number;notes:number;direction:'Forward'|'Reverse';division:number;gate:number;swing:number;variation:number;steps:Step[];source:'SAMPLE'|'SYNTH';rate:number;loop:boolean;crossfade:number;reverb:number;pan:number;signature:number;density:number;velocity:number;humanize:number};
export type Settings={version:1;bpm:number;root:string;scale:string;master:number;layers:Record<Edge,LayerSettings>};
export const KEY='finger-symphony-drone-v1';
export function defaults():Settings{
 const layers={} as Record<Edge,LayerSettings>;
 EDGES.forEach(edge=>layers[edge]={preset:PRESETS[edge][0],volume:edge==='bottom'?.45:.35,mode:'INFINITE',duration:16,fadeIn:1,fadeOut:2,retrigger:'RESTART',octave:edge==='bottom'?2:4,cutoff:edge==='bottom'?700:6000,resonance:1,attack:.2,release:.5,detune:7,width:.6,sub:.3,octaves:1,notes:4,direction:'Forward',division:8,gate:.6,swing:0,variation:.1,steps:Array.from({length:16},(_,i)=>({on:edge==='top'?true:i%4===0||i%4===2,note:[0,4,7,11][i%4],velocity:.7,kit:i%4===0?0:1})),source:edge==='left'?'SAMPLE':'SYNTH',rate:1,loop:true,crossfade:.3,reverb:.2,pan:0,signature:4,density:1,velocity:.65,humanize:0});
 return{version:1,bpm:80,root:'C',scale:'Major',master:.65,layers};
}
export const ranges:Record<string,[number,number,number]>={volume:[0,1,.01],duration:[1,128,1],fadeIn:[0,16,.25],fadeOut:[0,32,.25],octave:[0,6,1],cutoff:[40,16000,10],resonance:[.1,12,.1],attack:[.01,8,.01],release:[.02,12,.01],detune:[0,50,1],width:[0,1,.01],sub:[0,1,.01],octaves:[1,4,1],notes:[1,16,1],gate:[.05,1,.05],swing:[0,.45,.01],variation:[0,.8,.01],rate:[.25,2,.05],crossfade:[.02,2,.02],reverb:[0,.8,.01],pan:[-1,1,.01],signature:[2,7,1],density:[0,1,.05],velocity:[.05,1,.05],humanize:[0,.04,.001]};
const num=(v:unknown,d:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;
export function validate(value:unknown):Settings{
 if(!value||typeof value!=='object'||(value as Settings).version!==1)throw Error('DRONE v1 JSON required');
 const d=defaults(),v=value as Settings;
 d.bpm=num(v.bpm,d.bpm,40,180);d.master=num(v.master,d.master,0,1);if(ROOTS.includes(v.root))d.root=v.root;if(Object.hasOwn(SCALES,v.scale))d.scale=v.scale;
 for(const edge of EDGES){const s=v.layers?.[edge];if(!s||typeof s!=='object')continue;const out=d.layers[edge];for(const [key,[min,max,step]] of Object.entries(ranges)){let n=num((s as any)[key],(out as any)[key],min,max);if(step===1)n=Math.round(n);(out as any)[key]=n}
 if(PRESETS[edge].includes(s.preset))out.preset=s.preset;
 for(const [key,choices] of Object.entries({mode:['INFINITE','TIMED'],retrigger:['RESTART','CANCEL'],direction:['Forward','Reverse'],source:['SAMPLE','SYNTH']}))if(choices.includes((s as any)[key]))(out as any)[key]=(s as any)[key];
 if([4,8,16].includes(s.division))out.division=s.division;if(typeof s.loop==='boolean')out.loop=s.loop;
 if(Array.isArray(s.steps)&&s.steps.length>=4&&s.steps.length<=16)out.steps=s.steps.map((x,i)=>({on:typeof x?.on==='boolean'?x.on:true,note:Math.round(num(x?.note,i%12,-24,48)),velocity:num(x?.velocity,.7,0,1),kit:Math.round(num(x?.kit,0,0,2))}));
 }return d;
}
export function load():Settings{try{return validate(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{return defaults()}}
export function save(s:Settings){localStorage.setItem(KEY,JSON.stringify(validate(s)))}
export function preset(s:LayerSettings,edge:Edge,name:string){s.preset=name;if(edge==='bottom'){s.cutoff=name==='Dark Drone'?180:name==='Saw'?1600:700;s.detune=name.includes('Drone')?12:4;s.sub=name==='Sub Bass'?.8:.3}if(edge==='right'){s.steps=s.steps.map((x,i)=>{const on=name==='Polyrhythm'?i%3===0||i%4===0:name==='Shaker'?i%2===0:name==='Ambient Percussion'?i%6===0:name==='Metallic Percussion'?i%3===0:name==='Dub Percussion'?[0,4,6].includes(i%8):i%4===0;const kit=name==='Soft Kick'||name==='Minimal Pulse'?0:name==='Shaker'?1:['Wood Block','Metallic Percussion','Ambient Percussion'].includes(name)?2:name==='Dub Percussion'?(i%8===0?0:i%8===4?2:1):i%4===0?0:2;return{...x,on,kit}})}}
