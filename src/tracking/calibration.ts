/** Capture timestamps are performance.now() milliseconds, never frame counts. */
export class CalibrationHold {
  elapsed=0;
  complete=false;
  private last:number|undefined;
  private positive=false;
  private lostSince:number|undefined;
  constructor(readonly duration=1000,readonly grace=500){
    if(!Number.isFinite(duration)||duration<500||duration>5000)throw new Error('Calibration duration must be 0.5–5.0 seconds');
  }
  expire(now:number){
    if(this.complete)return;
    if((this.last!==undefined&&now-this.last>this.grace)||(this.lostSince!==undefined&&now-this.lostSince>this.grace)){
      this.elapsed=0;this.positive=false;
    }
  }
  observe(valid:boolean,now:number){
    if(this.complete||!Number.isFinite(now)||(this.last!==undefined&&now<=this.last))return;
    this.expire(now);
    // Credit only intervals bounded by two valid observations. Recovery never
    // credits an interval containing a missing observation, even within grace.
    if(valid){
      if(this.positive&&this.last!==undefined)this.elapsed=Math.min(this.duration,this.elapsed+now-this.last);
      this.lostSince=undefined;
    }else this.lostSince??=now;
    this.last=now;this.positive=valid;this.complete=this.elapsed>=this.duration;
  }
}
