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
