export class NodDetector{
 private baseline?:number;private downAt?:number;private lastNod=-Infinity;
 constructor(private minDisplacement=.025,private returnTolerance=.014,private maxTime=1200,private cooldown=1600){}
 reset(){this.baseline=undefined;this.downAt=undefined}
 update(y:number,now:number){if(this.baseline===undefined){this.baseline=y;return false}if(now-this.lastNod<this.cooldown)return false;if(this.downAt===undefined){if(y-this.baseline>=this.minDisplacement)this.downAt=now;else this.baseline=this.baseline*.95+y*.05;return false}if(now-this.downAt>this.maxTime){this.reset();return false}if(Math.abs(y-this.baseline)<=this.returnTolerance){this.lastNod=now;this.reset();return true}return false}
}
