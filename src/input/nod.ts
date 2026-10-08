export class NodDetector{
  private baseline?:number;private downAt?:number;private lastNod=-Infinity;
  constructor(private minDisplacement=.025,private returnTolerance=.014,private maxTime=1200,private cooldown=1600){}
  reset(){this.baseline=undefined;this.downAt=undefined}
  update(y:number,now:number){if(this.baseline===undefined){this.baseline=y;return false}if(this.downAt===undefined){this.baseline=this.baseline*.94+y*.06;if(y-this.baseline>=this.minDisplacement&&now-this.lastNod>=this.cooldown)this.downAt=now;return false}if(now-this.downAt>this.maxTime){this.downAt=undefined;this.baseline=y;return false}if(Math.abs(y-this.baseline)<=this.returnTolerance){this.downAt=undefined;this.lastNod=now;return true}return false}
}
