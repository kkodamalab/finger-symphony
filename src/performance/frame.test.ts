import { describe, expect, it } from 'vitest';
import { CrossingTracker, edgeNote, segmentFrameCrossings, type Frame } from './frame';
const frame: Frame = { x: .2, y: .2, width: .6, height: .6 };
describe('frame crossing', () => {
  it('does not trigger while a finger remains inside', () => expect(segmentFrameCrossings({x:.3,y:.3},{x:.7,y:.7},frame)).toEqual([]));
  it('detects entry and exit on all four edges', () => {
    expect(segmentFrameCrossings({x:.5,y:0},{x:.5,y:.5},frame)[0].edge).toBe('top');
    expect(segmentFrameCrossings({x:1,y:.5},{x:.5,y:.5},frame)[0].edge).toBe('right');
    expect(segmentFrameCrossings({x:.5,y:1},{x:.5,y:.5},frame)[0].edge).toBe('bottom');
    expect(segmentFrameCrossings({x:0,y:.5},{x:.5,y:.5},frame)[0].edge).toBe('left');
  });
  it('detects a fast pass through and orders crossings', () => expect(segmentFrameCrossings({x:0,y:.5},{x:1,y:.5},frame).map(x=>x.edge)).toEqual(['left','right']));
  it('emits every edge of a one-frame pass in trajectory order', () => {
    const tracker=new CrossingTracker({cooldownMs:120,minDistance:.02,hysteresis:.01});
    tracker.updateAll({x:0,y:.5},frame,0);
    expect(tracker.updateAll({x:1,y:.5},frame,20).map(x=>x.edge)).toEqual(['left','right']);
    tracker.updateAll({x:0,y:.5},frame,40);
    expect(tracker.updateAll({x:1,y:.5},frame,60)).toEqual([]);
  });
  it('maps different positions and edges to different notes', () => {
    const a=edgeNote(segmentFrameCrossings({x:.25,y:0},{x:.25,y:.5},frame)[0]);
    const b=edgeNote(segmentFrameCrossings({x:.7,y:0},{x:.7,y:.5},frame)[0]);
    const c=edgeNote(segmentFrameCrossings({x:0,y:.5},{x:.5,y:.5},frame)[0]);
    expect(new Set([a.index,b.index,c.index]).size).toBe(3);
  });
  it('suppresses jitter, cooldown repeats, and a jump after reset', () => {
    const tracker=new CrossingTracker({cooldownMs:120,minDistance:.02,hysteresis:.01});
    tracker.update({x:.5,y:.1},frame,0); expect(tracker.update({x:.5,y:.5},frame,20)?.edge).toBe('top');
    expect(tracker.update({x:.5,y:.19},frame,30)).toBeUndefined();
    tracker.reset(); expect(tracker.update({x:.5,y:.9},frame,1000)).toBeUndefined();
  });
});
