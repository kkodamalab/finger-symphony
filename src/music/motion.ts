export const clamp01=(value:number)=>Math.max(0,Math.min(1,value));

export class SmoothedControl{
  value:number;
  constructor(initial=0,private alpha=.15){this.value=clamp01(initial)}
  update(input:number){this.value=(1-this.alpha)*this.value+this.alpha*clamp01(input);return this.value=clamp01(this.value)}
  reset(value=0){this.value=clamp01(value)}
}

export const handDistance=(left:{x:number;y:number},right:{x:number;y:number})=>clamp01(Math.hypot(left.x-right.x,left.y-right.y)/Math.SQRT2);
export const wobbleParameters=(distance:number)=>{const amount=clamp01(distance);return{amount,cutoff:140+amount*1260,lfoHz:.6+amount*7.4,resonance:2+amount*8}};
export const breakIntensity=(motionSpeed:number)=>clamp01(motionSpeed*5);
export const breakPatternIndex=(intensity:number)=>Math.min(3,Math.floor(clamp01(intensity)*4));

export class BreakControl{
  private smooth=new SmoothedControl(0,.15);private level=0;private changedAt=-Infinity;
  update(speed:number,now:number){const value=this.smooth.update(breakIntensity(speed)),candidate=breakPatternIndex(value);if(candidate!==this.level&&now-this.changedAt>=400){const boundary=Math.max(candidate,this.level)/4,away=Math.abs(value-boundary);if(away>=.06){this.level=candidate;this.changedAt=now}}return{value,pattern:this.level}}
  reset(){this.smooth.reset();this.level=0;this.changedAt=-Infinity}
}
