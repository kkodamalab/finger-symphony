export type ScaleName='major'|'natural minor'|'major pentatonic'|'minor pentatonic'|'dorian'|'mixolydian';
export type ProgressionName='pop'|'jazz'|'ambient'|'dub';
export const SCALES:Record<ScaleName,number[]>={
  major:[0,2,4,5,7,9,11],'natural minor':[0,2,3,5,7,8,10],
  'major pentatonic':[0,2,4,7,9],'minor pentatonic':[0,3,5,7,10],
  dorian:[0,2,3,5,7,9,10],mixolydian:[0,2,4,5,7,9,10],
};
export const PROGRESSIONS:Record<ProgressionName,number[]>={pop:[0,4,5,3],jazz:[1,4,0],ambient:[0,3,5,4],dub:[0,3]};
export const chordForDegree=(scale:ScaleName,degree:number,experimental=false)=>{
  const notes=SCALES[scale],pick=(offset:number)=>notes[(degree+offset)%notes.length]+12*Math.floor((degree+offset)/notes.length);
  const chord=[pick(0),pick(2),pick(4)];return experimental?[...chord,13]:chord;
};
export const melodicIndex=(scale:ScaleName,degree:number,zone:number,experimental=false)=>{
  const notes=SCALES[scale];return experimental?(zone*3+degree)%24:notes[(zone+degree)%notes.length]+12*Math.floor((zone+degree)/notes.length);
};
