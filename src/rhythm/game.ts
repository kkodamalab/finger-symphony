import type {PlayerId,Side,Status} from '../tracking/duo';

export type Mode='SOLO'|'CO-OP'|'BATTLE';
export type Pattern='ALTERNATE'|'SIMULTANEOUS'|'CROSS'|'MIRROR'|'FOLLOW'|'SHARED';
export type Grade='PERFECT'|'GREAT'|'GOOD'|'MISS';
export type ReachZone={x:number;y:number;rx:number;ry:number};
export type Settings={mode:Mode;bpm:number;duration:number;difficulty:'EASY'|'NORMAL'|'HARD';radius:number;reach:number;hand:'BOTH'|Side;windows:{perfect:number;great:number;good:number};latency:number;layout:'MIXED'|'HORIZONTAL'|'VERTICAL';maxTargets:number;zones?:Record<PlayerId,ReachZone>};
export const defaults:Settings={mode:'SOLO',bpm:100,duration:30,difficulty:'NORMAL',radius:.07,reach:.75,hand:'BOTH',windows:{perfect:80,great:160,good:250},latency:0,layout:'MIXED',maxTargets:4};
export type Requirement={player:PlayerId;side:Side};
export type Note={id:number;time:number;x:number;y:number;radius:number;pattern:Pattern;required:Requirement[];hits:Record<string,Grade>;measurements?:Record<string,{time:number;spatial:number;observed:number|null}>;grade?:Grade};
export type GameEvent={target_id:number;player_id:PlayerId;hand_side:Side;target_x:number;target_y:number;scheduled_time:number;hit_time:number|null;timing_error_ms:number|null;spatial_error:number|null;judgement:Grade|'UNPLAYED';score:number;observed_timestamp:number|null};
export type Cursor=Requirement&{x:number;y:number;status:Status};
export type Score={score:number;combo:number;maxCombo:number;counts:Record<Grade,number>};
const key=(r:Requirement)=>`${r.player}-${r.side}`;
const freshScore=():Score=>({score:0,combo:0,maxCombo:0,counts:{PERFECT:0,GREAT:0,GOOD:0,MISS:0}});
export function validate(s:Settings){
  if(!Number.isFinite(s.bpm)||s.bpm<60||s.bpm>160||!Number.isFinite(s.duration)||s.duration<10||s.duration>180)throw new Error('BPMは60〜160、時間は10〜180秒にしてください。');
  const {perfect,great,good}=s.windows;
  if(![perfect,great,good].every(Number.isFinite)||perfect<=0||perfect>great||great>good||good>500)throw new Error('判定窓は 0 < PERFECT ≤ GREAT ≤ GOOD ≤ 500ms にしてください。');
  if(![s.radius,s.reach,s.latency].every(Number.isFinite)||s.radius<.035||s.radius>.12||s.reach<.2||s.reach>1||Math.abs(s.latency)>300)throw new Error('ターゲット・リーチ・遅延補正の設定範囲を確認してください。');
  if(!Number.isInteger(s.maxTargets)||s.maxTargets<(s.mode==='BATTLE'?2:1)||s.maxTargets>4)throw new Error('同時表示数は1〜4（BATTLEは2〜4）にしてください。');
  if(s.zones){for(const id of (s.mode==='SOLO'?['P1']:['P1','P2']) as PlayerId[]){const z=s.zones[id],m=s.radius+.02;if(!z||![z.x,z.y,z.rx,z.ry].every(Number.isFinite)||z.rx<=0||z.ry<=0||Math.max(m,z.x-z.rx*s.reach)>Math.min(1-m,z.x+z.rx*s.reach)||Math.max(m,z.y-z.ry*s.reach)>Math.min(1-m,z.y+z.ry*s.reach))throw new Error('届く範囲にターゲットを配置できません。画面中央で再登録するか、ターゲットサイズを小さくしてください。')}}
}

export function reachZones(s:Settings):Record<PlayerId,ReachZone>{
  return s.zones??{P1:{x:s.mode==='SOLO'?.5:.25,y:.5,rx:s.mode==='SOLO'?.4:.34,ry:.32},P2:{x:.75,y:.5,rx:.34,ry:.32}};
}

/** Deterministic chart: both battle players receive identical rhythm, size and reach. */
export function makeChart(s:Settings):Note[]{
  validate(s);const notes:Note[]=[];const beat=60000/s.bpm;
  const step=beat*(s.difficulty==='EASY'?2:s.difficulty==='HARD'?.5:1),lead=2*beat;
  const patterns:Pattern[]=s.mode==='SOLO'?['ALTERNATE','SIMULTANEOUS','CROSS']:s.mode==='CO-OP'?['ALTERNATE','SIMULTANEOUS','MIRROR','FOLLOW','SHARED']:['ALTERNATE','SIMULTANEOUS','CROSS'];
  const add=(time:number,player:PlayerId,side:Side,pattern:Pattern,offset:number,shared=false)=>{
    if(time>s.duration*1000-s.windows.good)return;
    const zone=reachZones(s)[player],factor=s.difficulty==='EASY'?.45:s.difficulty==='NORMAL'?.7:1;
    const span=Math.min(s.mode==='SOLO'?.29:.15,zone.rx)*s.reach*factor;
    const margin=s.radius+.02;
    const x=shared?.5:Math.max(margin,zone.x-zone.rx*s.reach,Math.min(1-margin,zone.x+zone.rx*s.reach,zone.x+offset*span*(s.layout==='VERTICAL'?.35:1)));
    const y=Math.max(margin,zone.y-zone.ry*s.reach,Math.min(1-margin,zone.y+zone.ry*s.reach,zone.y+(s.layout==='HORIZONTAL'?0:Math.sin(time/step*1.7)*Math.min(.23,zone.ry)*s.reach*factor)));
    notes.push({id:notes.length,time,x,y,radius:s.radius,pattern,required:shared?[{player:'P1',side},{player:'P2',side:side==='L'?'R':'L'}]:[{player,side}],hits:{}});
  };
  for(let i=0,time=lead;time<=s.duration*1000-s.windows.good;i++,time+=step){
    const pattern=patterns[Math.floor(i/4)%patterns.length];
    const side:Side=s.hand==='BOTH'?(i%2?'R':'L'):s.hand;
    const offset=(side==='L'?-1:1)*(pattern==='CROSS'?-1:1);
    if(s.mode==='SOLO'){
      add(time,'P1',side,pattern,offset);
      if(pattern==='SIMULTANEOUS'&&s.hand==='BOTH')add(time,'P1',side==='L'?'R':'L',pattern,-offset);
    }else if(pattern==='SHARED'){
      const z=reachZones(s),m=s.radius+.02,left=Math.max(m,z.P1.x-z.P1.rx*s.reach,z.P2.x-z.P2.rx*s.reach),right=Math.min(1-m,z.P1.x+z.P1.rx*s.reach,z.P2.x+z.P2.rx*s.reach);
      const top=Math.max(m,z.P1.y-z.P1.ry*s.reach,z.P2.y-z.P2.ry*s.reach),bottom=Math.min(1-m,z.P1.y+z.P1.ry*s.reach,z.P2.y+z.P2.ry*s.reach);
      if(left<=right&&top<=bottom){add(time,'P1',side,pattern,0,true);const n=notes.at(-1)!;n.x=(left+right)/2;n.y=(top+bottom)/2}
      else{add(time,'P1',side,'SIMULTANEOUS',offset);add(time,'P2',side,'SIMULTANEOUS',offset)}
    }
    else if(s.mode==='CO-OP'&&pattern==='ALTERNATE')add(time,i%2?'P2':'P1',side,pattern,offset);
    else if(pattern==='FOLLOW'){
      // P2 repeats the P1 reach one beat later. Reserve the following beat for the response.
      if(i%2===0){add(time,'P1',side,pattern,offset);add(time+beat,'P2',side,pattern,offset)}
    }else{
      add(time,'P1',side,pattern,offset);
      add(time,'P2',pattern==='MIRROR'?(side==='L'?'R':'L'):side,pattern,pattern==='MIRROR'?-offset:offset);
      if(pattern==='SIMULTANEOUS'&&s.hand==='BOTH'){
        add(time,'P1',side==='L'?'R':'L',pattern,-offset);add(time,'P2',side==='L'?'R':'L',pattern,-offset);
      }
    }
  }
  const counts=new Map<number,number>();
  const limit=s.mode==='BATTLE'?Math.floor(s.maxTargets/2)*2:s.maxTargets;
  return notes.sort((a,b)=>a.time-b.time).filter(n=>{const count=counts.get(n.time)??0;if(count>=limit)return false;counts.set(n.time,count+1);return true});
}

export class RhythmGame {
  readonly notes:Note[];
  readonly scores:Record<PlayerId,Score>={P1:freshScore(),P2:freshScore()};
  private previous=new Map<string,{inside:boolean;time:number}>();
  private lastSample=-Infinity;
  feedback:{grade:Grade;player:string;time:number}[]=[];
  events:GameEvent[]=[];
  constructor(readonly settings:Settings){this.notes=makeChart(settings)}
  /** Sample time is capture time in the audio clock domain, not inference completion time. */
  sample(cursors:Cursor[],time:number,aspect=16/9,observedTimestamp:number|null=null){
    if(time<=this.lastSample)return;this.lastSample=time;
    const claimed=new Set<string>();
    for(const n of this.visible(time)){
      if(n.grade||time<n.time-2000||time>n.time+this.settings.windows.good)continue;
      for(const r of n.required){
        const id=key(r),k=`${n.id}:${id}`,c=cursors.find(c=>key(c)===id);
        if(!c||c.status!=='TRACKING'){this.previous.delete(k);continue}
        const inside=Math.hypot((c.x-n.x)*aspect,c.y-n.y)<=n.radius;
        const prev=this.previous.get(k);this.previous.set(k,{inside,time});
        // New/reacquired cursors must first be observed outside, and stale samples cannot arm a hit.
        if(!inside||!prev||prev.inside||time-prev.time>250||n.hits[id]||claimed.has(id))continue;
        const error=Math.abs(time-n.time),w=this.settings.windows;
        if(error>w.good)continue;
        n.hits[id]=error<=w.perfect?'PERFECT':error<=w.great?'GREAT':'GOOD';claimed.add(id);
        (n.measurements??={})[id]={time,spatial:Math.hypot((c.x-n.x)*aspect,c.y-n.y),observed:observedTimestamp};
      }
      if(n.required.every(r=>n.hits[key(r)])){
        const grades=n.required.map(r=>n.hits[key(r)]);
        this.finish(n,grades.includes('GOOD')?'GOOD':grades.includes('GREAT')?'GREAT':'PERFECT',time);
      }
    }
  }
  expire(time:number){for(const n of this.notes)if(!n.grade&&time>n.time+this.settings.windows.good)this.finish(n,'MISS',time)}
  invalidate(){this.previous.clear()}
  visible(time:number){return this.notes.filter(n=>!n.grade&&n.time-time<=1800&&time-n.time<=this.settings.windows.good).slice(0,this.settings.mode==='BATTLE'?Math.floor(this.settings.maxTargets/2)*2:this.settings.maxTargets)}
  exportEvents():GameEvent[]{return [...this.events,...this.notes.filter(n=>!n.grade).flatMap(n=>n.required.map(r=>this.event(n,r,'UNPLAYED',0)))].sort((a,b)=>a.scheduled_time-b.scheduled_time)}
  private event(n:Note,r:Requirement,grade:Grade|'UNPLAYED',score:number):GameEvent{
    const measurement=n.measurements?.[key(r)];
    return {target_id:n.id,player_id:r.player,hand_side:r.side,target_x:n.x,target_y:n.y,scheduled_time:n.time,hit_time:measurement?.time??null,timing_error_ms:measurement?measurement.time-n.time:null,spatial_error:measurement?.spatial??null,judgement:grade,score,observed_timestamp:measurement?.observed??null};
  }
  private finish(n:Note,grade:Grade,time:number){
    n.grade=grade;
    n.required.forEach(r=>this.events.push(this.event(n,r,grade,grade==='MISS'?0:grade==='PERFECT'?1000:grade==='GREAT'?700:400)));
    for(const player of new Set(n.required.map(r=>r.player))){
      const score=this.scores[player];score.counts[grade]++;
      if(grade==='MISS')score.combo=0;else{score.combo++;score.score+=grade==='PERFECT'?1000:grade==='GREAT'?700:400;score.maxCombo=Math.max(score.maxCombo,score.combo)}
    }
    this.feedback.push({grade,player:[...new Set(n.required.map(r=>r.player))].join('+'),time});
    this.feedback=this.feedback.slice(-6);
    n.required.forEach(r=>this.previous.delete(`${n.id}:${key(r)}`));
  }
  get winner(){return this.scores.P1.score===this.scores.P2.score?'DRAW':this.scores.P1.score>this.scores.P2.score?'P1':'P2'}
}
