import{describe,expect,it}from'vitest';
import{clampSegments,ContactTracker,DEFAULT_FIELD_SETTINGS,DEFAULT_FRAME,frameFromPoints}from'./settings';
describe('performance field settings',()=>{
  it('clamps segment counts to 1–8',()=>{expect(clampSegments(-2)).toBe(1);expect(clampSegments(9)).toBe(8)});
  it('builds a frame from four hand points',()=>{const frame=frameFromPoints([{x:.2,y:.3},{x:.3,y:.2},{x:.8,y:.7},{x:.7,y:.8}])!;expect(frame.x).toBe(.2);expect(frame.y).toBe(.2);expect(frame.width).toBeCloseTo(.6);expect(frame.height).toBeCloseTo(.6)});
  it('rejects tiny accidental frames',()=>expect(frameFromPoints([{x:.1,y:.1},{x:.11,y:.1},{x:.1,y:.11},{x:.11,y:.11}])).toBeUndefined());
  it('fires contact only after dwell time and once per stay',()=>{const tracker=new ContactTracker(),settings={...DEFAULT_FIELD_SETTINGS,contactTime:100,contactDistance:.02},point={x:.5,y:.205};expect(tracker.update(point,DEFAULT_FRAME,0,settings,120)).toBeUndefined();expect(tracker.update(point,DEFAULT_FRAME,99,settings,120)).toBeUndefined();expect(tracker.update(point,DEFAULT_FRAME,100,settings,120)?.edge).toBe('top');expect(tracker.update(point,DEFAULT_FRAME,500,settings,120)).toBeUndefined()});
  it('responds to wider contact distance',()=>{const tight=new ContactTracker(),wide=new ContactTracker(),point={x:.5,y:.17};tight.update(point,DEFAULT_FRAME,0,{...DEFAULT_FIELD_SETTINGS,contactDistance:.01,contactTime:0},120);wide.update(point,DEFAULT_FRAME,0,{...DEFAULT_FIELD_SETTINGS,contactDistance:.04,contactTime:0},120);expect(tight.update(point,DEFAULT_FRAME,1,{...DEFAULT_FIELD_SETTINGS,contactDistance:.01,contactTime:0},120)).toBeUndefined();expect(wide.update(point,DEFAULT_FRAME,1,{...DEFAULT_FIELD_SETTINGS,contactDistance:.04,contactTime:0},120)?.edge).toBe('top')});
});
