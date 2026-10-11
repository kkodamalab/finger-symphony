import {describe,it,expect} from 'vitest';
import {defaults,RhythmGame,makeChart,validate,type Cursor,type Settings} from './game';

function setup(){const game=new RhythmGame({...defaults,duration:10});const n=game.notes[0];const cursor:Cursor={...n.required[0],x:n.x,y:n.y,status:'TRACKING'};return {game,n,cursor}}
describe('entry and beat judgment',()=>{
  it.each([[0,'PERFECT'],[80,'PERFECT'],[-80,'PERFECT'],[81,'GREAT'],[160,'GREAT'],[161,'GOOD'],[250,'GOOD'],[-250,'GOOD']])('grades entry at %sms as %s',(offset,grade)=>{
    const {game,n,cursor}=setup(),time=n.time+Number(offset);game.sample([{...cursor,y:0}],time-40);game.sample([cursor],time);expect(n.grade).toBe(grade);
  });
  it('rejects a cursor first seen inside and a hand held inside',()=>{
    const {game,n,cursor}=setup();game.sample([cursor],n.time-100);game.sample([cursor],n.time);game.expire(n.time+251);expect(n.grade).toBe('MISS');
  });
  it('requires leaving and re-entering after an early entry',()=>{
    const {game,n,cursor}=setup();game.sample([{...cursor,y:0}],n.time-400);game.sample([cursor],n.time-300);game.sample([cursor],n.time);expect(n.grade).toBeUndefined();game.sample([{...cursor,y:0}],n.time+20);game.sample([cursor],n.time+60);expect(n.grade).toBe('PERFECT');
  });
  it('rejects the wrong player and wrong hand',()=>{
    for(const change of [{player:'P2' as const},{side:'R' as const}]){const {game,n,cursor}=setup();game.sample([{...cursor,...change,y:0}],n.time-40);game.sample([{...cursor,...change}],n.time);game.expire(n.time+251);expect(n.grade).toBe('MISS')}
  });
  it.each(['LOST','UNCERTAIN'] as const)('does not re-arm through %s',status=>{
    const {game,n,cursor}=setup();game.sample([{...cursor,y:0}],n.time-100);game.sample([{...cursor,status}],n.time-50);game.sample([cursor],n.time);expect(n.grade).toBeUndefined();
  });
  it('rejects stale outside evidence and repeated timestamps',()=>{
    const {game,n,cursor}=setup();game.sample([{...cursor,y:0}],n.time-300);game.sample([cursor],n.time);expect(n.grade).toBeUndefined();game.sample([{...cursor,y:0}],n.time);game.sample([cursor],n.time+1);expect(n.grade).toBeUndefined();
  });
  it('does not allow one entry to hit multiple overlapping notes',()=>{
    const {game,n,cursor}=setup();game.notes.push({...n,id:999,hits:{}});game.sample([{...cursor,y:0}],n.time-40);game.sample([cursor],n.time);expect(game.scores.P1.counts.PERFECT).toBe(1);
  });
  it('uses a circle in rendered pixel space',()=>{
    const {game,n,cursor}=setup();game.sample([{...cursor,x:n.x+.06}],n.time-40,2);game.sample([cursor],n.time,2);expect(n.grade).toBe('PERFECT');
  });
  it('waits for both participants on shared targets',()=>{
    const game=new RhythmGame({...defaults,mode:'CO-OP',duration:30}),n=game.notes.find(n=>n.pattern==='SHARED')!;
    const cs=n.required.map(r=>({...r,x:n.x,y:n.y,status:'TRACKING' as const}));game.sample(cs.map(c=>({...c,y:0})),n.time-80);game.sample([cs[0],{...cs[1],y:0}],n.time);expect(n.grade).toBeUndefined();game.sample(cs,n.time+50);expect(n.grade).toBe('PERFECT');expect(game.scores.P1.score).toBe(1000);expect(game.scores.P2.score).toBe(1000);
  });
  it('resets combo on a miss and preserves maximum combo',()=>{
    const {game,n,cursor}=setup();game.sample([{...cursor,y:0}],n.time-40);game.sample([cursor],n.time);game.expire(game.notes[1].time+251);expect(game.scores.P1.combo).toBe(0);expect(game.scores.P1.maxCombo).toBe(1);
  });
});
describe('charts and settings',()=>{
  it('limits simultaneous visible targets and preserves battle parity for odd limits',()=>{
    for(const mode of ['SOLO','CO-OP','BATTLE'] as const)for(const maxTargets of (mode==='BATTLE'?[2,3,4]:[1,2,3,4])){
      const game=new RhythmGame({...defaults,mode,maxTargets,difficulty:'HARD'});
      for(let t=0;t<30000;t+=137)expect(game.visible(t).length).toBeLessThanOrEqual(maxTargets);
      if(mode==='BATTLE')expect(game.notes.filter(n=>n.required[0].player==='P1').length).toBe(game.notes.filter(n=>n.required[0].player==='P2').length);
    }
  });
  it('keeps target circles away from edges at extreme settings',()=>{
    for(const mode of ['SOLO','CO-OP','BATTLE'] as const)for(const difficulty of ['EASY','NORMAL','HARD'] as const)for(const bpm of [60,160]){
      const notes=makeChart({...defaults,mode,difficulty,bpm,radius:.12,reach:1});expect(notes.every(n=>n.x>=.12&&n.x<=.88&&n.y>=.12&&n.y<=.88)).toBe(true);
    }
  });
  it('changes travel distance and supports horizontal and vertical layouts',()=>{
    const span=(s:Settings)=>{const ns=makeChart(s);return Math.max(...ns.map(n=>n.x))-Math.min(...ns.map(n=>n.x))};
    expect(span({...defaults,difficulty:'EASY'})).toBeLessThan(span({...defaults,difficulty:'NORMAL'}));expect(span({...defaults,difficulty:'NORMAL'})).toBeLessThan(span({...defaults,difficulty:'HARD'}));
    expect(makeChart({...defaults,layout:'HORIZONTAL'}).every(n=>n.y===.5)).toBe(true);expect(span({...defaults,layout:'VERTICAL'})).toBeLessThan(span(defaults));
  });
  it('replaces unreachable shared targets with local cooperative targets',()=>{
    const notes=makeChart({...defaults,mode:'CO-OP',duration:60,reach:.2});expect(notes.some(n=>n.pattern==='SHARED')).toBe(false);expect(notes.some(n=>n.pattern==='SIMULTANEOUS')).toBe(true);
  });
  it('gives battle players exactly equal opportunities and relative positions',()=>{
    const notes=makeChart({...defaults,mode:'BATTLE',duration:180,difficulty:'HARD'}),p1=notes.filter(n=>n.required[0].player==='P1'),p2=notes.filter(n=>n.required[0].player==='P2');expect(p1.length).toBe(p2.length);p1.forEach((n,i)=>{expect(p2[i].time).toBe(n.time);expect(p2[i].x-n.x).toBeCloseTo(.5);expect(p2[i].y).toBe(n.y);expect(p2[i].radius).toBe(n.radius)})
  });
  it('only requests the selected hand in single-hand SOLO',()=>{
    for(const hand of ['L','R'] as const)expect(makeChart({...defaults,hand}).every(n=>n.required.every(r=>r.side===hand))).toBe(true);
  });
  it('includes all cooperative patterns and delays FOLLOW by a beat',()=>{
    const notes=makeChart({...defaults,mode:'CO-OP',duration:60});expect(new Set(notes.map(n=>n.pattern))).toEqual(new Set(['ALTERNATE','SIMULTANEOUS','MIRROR','FOLLOW','SHARED']));const f=notes.filter(n=>n.pattern==='FOLLOW');expect(f[1].time-f[0].time).toBe(60000/defaults.bpm);
  });
  it('scales density with difficulty',()=>{
    const counts=(['EASY','NORMAL','HARD'] as const).map(difficulty=>makeChart({...defaults,difficulty}).length);expect(counts[0]).toBeLessThan(counts[1]);expect(counts[1]).toBeLessThan(counts[2]);
  });
  it('rejects invalid ranges and judgment ordering',()=>{
    for(const patch of [{bpm:NaN},{duration:181},{radius:0},{reach:2},{latency:301},{windows:{perfect:200,great:100,good:250}}])expect(()=>validate({...defaults,...patch} as Settings)).toThrow();
  });
});
