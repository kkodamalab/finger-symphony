import {describe,it,expect} from 'vitest';
import {IdentityTracker,type Point,type RawFrame} from './duo';

function pose(x:number):Point[]{
  const p=Array.from({length:33},()=>({x,y:.5,visibility:1}));
  p[11]={x:x+.07,y:.45,visibility:1};p[12]={x:x-.07,y:.45,visibility:1};
  p[15]={x:x+.09,y:.2,visibility:1};p[16]={x:x-.09,y:.2,visibility:1};return p;
}
function raw(xs:number[],timestamp:number):RawFrame{
  const poses=xs.map(pose);return {timestamp,poses,hands:poses.flatMap(p=>[15,16].map(i=>Array.from({length:21},()=>({...p[i]}))))};
}
describe('duo identity and calibration',()=>{
  it.each([1,2] as const)('accepts real MediaPipe hand visibility=0 for %s people',count=>{
    const tracker=new IdentityTracker(count),xs=count===1?[.5]:[.25,.75];let f;
    for(let t=0;t<=1200;t+=300){const input=raw(xs,t);input.hands.forEach(h=>h.forEach(p=>p.visibility=0));f=tracker.update(input)}
    expect(f!.hands.filter(h=>h.status==='TRACKING')).toHaveLength(count*2);expect(tracker.calibrated).toBe(true);
  });
  it('shows partial progress at 4 FPS and resets on an actually missing hand',()=>{
    const tracker=new IdentityTracker(1);tracker.update(raw([.5],0));tracker.update(raw([.5],270));tracker.update(raw([.5],540));expect(tracker.progress).toBeCloseTo(.54);
    const lost=raw([.5],810);lost.hands.pop();tracker.update(lost);expect(tracker.progress).toBe(0);expect(tracker.calibrated).toBe(false);
    for(let t=1080;t<=2160;t+=270)tracker.update(raw([.5],t));expect(tracker.calibrated).toBe(true);
  });
  it('explains zero detections after ten seconds and fully clears progress on reset',()=>{
    const tracker=new IdentityTracker(1);for(let t=0;t<=10000;t+=250){const r=raw([.5],t);r.hands=[];tracker.update(r)}
    expect(tracker.calibration(10000)).toMatchObject({progress:0,timedOut:true});expect(tracker.reason).toContain('検出が0件');expect(tracker.calibrated).toBe(false);
    tracker.reset();expect(tracker.players).toEqual([]);expect(tracker.calibration(10000).timedOut).toBe(false);expect(tracker.progress).toBe(0);
  });
  it('retains Pose visibility checks while diagnosing rejected hand assignments',()=>{
    const tracker=new IdentityTracker(1),r=raw([.5],0);r.poses[0][15].visibility=.1;const f=tracker.update(r);expect(f.handCount).toBe(2);expect(f.hands[0].status).toBe('LOST');expect(f.hands[0].reason).toContain('可視性不足');
  });
  it('registers screen-left P1 under mirroring and keeps anatomical hands',()=>{
    const tracker=new IdentityTracker(2,true);const f=tracker.update(raw([.25,.75],0));
    expect(f.players.find(p=>p.id==='P1')!.pose[11].x).toBeCloseTo(.82);
    expect(f.hands.find(h=>h.player==='P1'&&h.side==='L')!.points[0].x).toBeCloseTo(.84);
    expect(f.hands.every(h=>h.status==='TRACKING')).toBe(true);
  });
  it('keeps IDs when detector order changes',()=>{
    const tracker=new IdentityTracker(2,false);tracker.update(raw([.25,.75],0));const f=tracker.update(raw([.76,.26],100));
    expect(f.players[0].pose[11].x).toBeCloseTo(.33);expect(f.players[1].pose[11].x).toBeCloseTo(.83);
  });
  it('requires continuous stable raised-hand evidence',()=>{
    const tracker=new IdentityTracker(2);for(let t=0;t<=900;t+=100)tracker.update(raw([.25,.75],t));
    expect(tracker.calibrated).toBe(false);tracker.update(raw([.25,.75],1000));expect(tracker.calibrated).toBe(true);
    tracker.reset();tracker.update(raw([.25,.75],0));tracker.update(raw([.25,.75],1000));expect(tracker.calibrated).toBe(false);
  });
  it('restores the same ID after brief loss but blocks long loss until reset',()=>{
    const tracker=new IdentityTracker(2,false);tracker.update(raw([.25,.75],0));
    expect(tracker.update(raw([.75],100)).players[0].status).toBe('LOST');
    expect(tracker.update(raw([.25,.75],500)).players[0].status).toBe('TRACKING');
    tracker.update(raw([.75],1500));expect(tracker.update(raw([.25,.75],2200)).players[0].status).toBe('UNCERTAIN');
    tracker.reset();expect(tracker.update(raw([.25,.75],2300)).players[0].status).toBe('TRACKING');
  });
  it('blocks overlapping people and ambiguous wrists',()=>{
    const tracker=new IdentityTracker(2,false);tracker.update(raw([.35,.65],0));
    const f=tracker.update(raw([.46,.54],100));expect(f.players.every(p=>p.status==='UNCERTAIN')).toBe(true);expect(f.hands.some(h=>h.status==='TRACKING')).toBe(false);
    const one=new IdentityTracker(1,false),input=raw([.5],0);input.hands=[Array.from({length:21},()=>({x:.5,y:.2}))];
    expect(one.update(input).hands.some(h=>h.status==='UNCERTAIN')).toBe(true);
  });
  it('does not assign two detections to the same wrist',()=>{
    const tracker=new IdentityTracker(1,false),input=raw([.5],0);input.hands=[input.hands[0],input.hands[0]];
    expect(tracker.update(input).hands.some(h=>h.status==='TRACKING')).toBe(false);
  });
  it('does not silently swap identities when people cross during an overlap',()=>{
    const tracker=new IdentityTracker(2,false);tracker.update(raw([.35,.65],0));tracker.update(raw([.46,.54],100));
    const separated=tracker.update(raw([.65,.35],200));expect(tracker.needsRegistration).toBe(true);expect(separated.players.every(p=>p.status==='UNCERTAIN')).toBe(true);expect(tracker.calibrated).toBe(false);
  });
  it('supports selected-hand calibration without requiring the other hand',()=>{
    const tracker=new IdentityTracker(1,false,'L');for(let t=0;t<=1000;t+=100){const f=raw([.5],t);f.hands=f.hands.slice(0,1);tracker.update(f)}expect(tracker.calibrated).toBe(true);
  });
});
