import {describe,it,expect} from 'vitest';
import {DroneContactTracker} from './contact';
import {LayerState} from './state';
import {defaults,validate,EDGES,preset} from './settings';
const frame={x:.2,y:.2,width:.6,height:.6},settings={contactDistance:.02,contactTime:100,edgeSegments:6},touch={x:.5,y:.8},away={x:.5,y:.5};
describe('DRONE aggregate contacts',()=>{
 it('requires contact time and only fires once while held',()=>{const t=new DroneContactTracker();expect(t.update([touch],frame,0,settings)).toEqual([]);expect(t.update([touch],frame,100,settings)).toEqual(['bottom']);expect(t.update([touch],frame,1000,settings)).toEqual([])});
 it('aggregates multiple fingers and hands into one edge event',()=>{const t=new DroneContactTracker();t.update([touch,touch,touch],frame,0,settings);expect(t.update([touch,touch,touch],frame,100,settings)).toEqual(['bottom'])});
 it('requires confirmed release and cooldown before retouch',()=>{const t=new DroneContactTracker();t.update([touch],frame,0,settings);t.update([touch],frame,100,settings);t.update([away],frame,200,settings);t.update([away],frame,330,settings);t.update([touch],frame,340,settings);expect(t.update([touch],frame,450,settings)).toEqual(['bottom'])});
 it('does not release inside hysteresis band',()=>{const t=new DroneContactTracker();t.update([touch],frame,0,settings);t.update([touch],frame,100,settings);t.update([{x:.5,y:.829}],frame,300,settings);t.update([{x:.5,y:.829}],frame,600,settings);expect(t.update([touch],frame,900,settings)).toEqual([])});
 it('retains latch across tracking loss and cancels incomplete dwell',()=>{const t=new DroneContactTracker();t.update([touch],frame,0,settings);t.update([touch],frame,100,settings);t.update([],frame,300,settings);expect(t.update([touch],frame,1000,settings)).toEqual([]);const u=new DroneContactTracker();u.update([touch],frame,0,settings);u.update([],frame,90,settings);expect(u.update([touch],frame,1000,settings)).toEqual([])});
 it('can touch all four edges at once',()=>{const t=new DroneContactTracker(),points=[touch,{x:.5,y:.2},{x:.2,y:.5},{x:.8,y:.5}];t.update(points,frame,0,settings);expect(t.update(points,frame,100,settings)).toEqual(EDGES)});
});
describe('DRONE beat lifecycle',()=>{
 it('defaults all four layers to infinite',()=>expect(EDGES.every(e=>defaults().layers[e].mode==='INFINITE')).toBe(true));
 it('sustains infinite and fades on second touch',()=>{const s=defaults().layers.bottom,x=new LayerState();x.toggle(0,s);x.update(1000,s);expect(x.phase).toBe('ON');x.toggle(1000,s);expect(x.phase).toBe('FADE');x.update(1002,s);expect(x.phase).toBe('OFF')});
 it('starts fade after duration, not before',()=>{const s={...defaults().layers.bottom,mode:'TIMED' as const,duration:8,fadeOut:4},x=new LayerState();x.start(0);x.update(7.9,s);expect(x.phase).toBe('ON');x.update(8,s);expect(x.phase).toBe('FADE');expect(x.level(10,s)).toBe(.5);x.update(12,s);expect(x.phase).toBe('OFF')});
 it.each(['RESTART','CANCEL'] as const)('handles %s during fade',retrigger=>{const s={...defaults().layers.top,retrigger},x=new LayerState();x.start(0);x.stop(4,s);x.toggle(5,s);expect(x.phase).toBe(retrigger==='RESTART'?'ON':'OFF');if(retrigger==='RESTART')expect(x.started).toBe(5)});
 it('zero fade stops immediately',()=>{const x=new LayerState(),s={...defaults().layers.left,fadeOut:0};x.start(0);x.stop(1,s);expect(x.phase).toBe('OFF')});
 it('panic resets state and level',()=>{const x=new LayerState(),s=defaults().layers.right;x.start(0);x.panic();expect(x.level(5,s)).toBe(0)});
 it('layers have independent state and durations',()=>{const xs=EDGES.map(()=>new LayerState()),s=defaults();xs.forEach(x=>x.start(0));xs[0].stop(2,{...s.layers.bottom,fadeOut:0});expect(xs.map(x=>x.phase)).toEqual(['OFF','ON','ON','ON'])});
});
describe('DRONE persistence and patterns',()=>{
 it('round trips all parameters without shared references',()=>{const s=defaults();s.layers.top.steps[2]={on:false,note:17,velocity:.3,kit:2};s.layers.left.source='SAMPLE';expect(validate(JSON.parse(JSON.stringify(s)))).toEqual(s);expect(validate(s).layers.top.steps).not.toBe(s.layers.top.steps)});
 it('rejects foreign formats and clamps malformed values',()=>{expect(()=>validate({version:2})).toThrow();const s=defaults();s.bpm=Infinity;s.layers.bottom.volume=8;s.layers.top.steps=[];const v=validate(s);expect(v.bpm).toBe(80);expect(v.layers.bottom.volume).toBe(1);expect(v.layers.top.steps.length).toBe(16)});
 it('presets create editable percussion patterns',()=>{const s=defaults().layers.right;preset(s,'right','Polyrhythm');expect(s.steps[3].on).toBe(true);expect(s.steps[4].on).toBe(true);expect(s.steps[5].on).toBe(false)});
});
it('does not release a missing hand while the other hand stays visible',()=>{const t=new DroneContactTracker(),left={...touch,owner:'Left'},right={...away,owner:'Right'};t.update([left,right],frame,0,settings);expect(t.update([left,right],frame,100,settings)).toEqual(['bottom']);t.update([right],frame,300,settings);t.update([right],frame,600,settings);expect(t.update([left,right],frame,900,settings)).toEqual([])});
import {seamlessLoop} from './sample';
it('blends sample boundary without a discontinuity and preserves original',()=>{const input=Float32Array.from([0,1,2,3,4,5,6,7,8,9,10,11]);const output=seamlessLoop(input,3);expect([...output]).toEqual([3,4,5,6,7,8,6,4,2]);expect(output[0]-output.at(-1)!).toBe(1);expect(input[11]).toBe(11)});
