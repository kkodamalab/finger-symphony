import {beforeEach,describe,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>{
  const param=()=>({value:0,rampTo:vi.fn(),cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn()});
  const nodes:any[]=[];
  class Node {gain=param();frequency=param();feedback=param();filter={frequency:param(),Q:param()};dispose=vi.fn();releaseAll=vi.fn();triggerAttack=vi.fn();triggerRelease=vi.fn();triggerAttackRelease=vi.fn();set=vi.fn();stop=vi.fn();constructor(..._:unknown[]){nodes.push(this)}connect(){return this}toDestination(){return this}start(){return this}}
  return {Node,nodes,start:vi.fn(async()=>{}),transport:{start:vi.fn(),stop:vi.fn(),clear:vi.fn(),scheduleRepeat:vi.fn(()=>1),bpm:param(),seconds:0,state:'started',nextSubdivision:()=>1}};
});
vi.mock('tone',()=>({PolySynth:f.Node,Synth:f.Node,Limiter:f.Node,Gain:f.Node,FeedbackDelay:f.Node,Reverb:f.Node,MonoSynth:f.Node,MembraneSynth:f.Node,NoiseSynth:f.Node,Distortion:f.Node,LFO:f.Node,start:f.start,getTransport:()=>f.transport,getContext:()=>({state:'running'}),now:()=>1,immediate:()=>1,Frequency:()=>({toMidi:()=>60,toNote:()=> 'C4',toFrequency:()=>440})}));
import {MusicEngine} from './engine';
beforeEach(()=>{vi.clearAllMocks();f.nodes.length=0;f.start.mockResolvedValue()});
describe('Playground engine isolation and audio controls',()=>{
  it.each(['band','techno','ambient','dub','dubstep','jungle'] as const)('plays edge notes in %s after user audio start',async mode=>{const m=new MusicEngine();m.setMode(mode);expect(m.handleEdge({edge:'top',zone:1,velocity:.5,direction:'in'})).toBe('');await m.setEnabled(true);expect(m.handleEdge({edge:'top',zone:1,velocity:.5,direction:'in'})).not.toBe('');expect(f.nodes.some(n=>n.triggerAttackRelease.mock.calls.length)).toBe(true);m.dispose()});
  it('preserves zero master volume through audio enable and stops transport on disable',async()=>{const m=new MusicEngine();m.setVolumes(0,.7,.4);await m.setEnabled(true);expect(m.diagnostics).toMatchObject({enabled:true,master:0,muted:true});await m.setEnabled(false);expect(f.transport.stop).toHaveBeenCalled();expect(m.activePatternCount).toBe(0)});
  it('cannot resume a disposed engine when Tone.start resolves after pagehide',async()=>{let resolve!:()=>void;f.start.mockImplementationOnce(()=>new Promise<void>(r=>resolve=r));const m=new MusicEngine(),pending=m.setEnabled(true);m.dispose();resolve();await pending;expect(f.transport.start).not.toHaveBeenCalled();expect(m.diagnostics.enabled).toBe(false);m.dispose();expect(f.nodes.every(n=>n.dispose.mock.calls.length===1)).toBe(true)});
  it('starts and releases theremin only while enabled',async()=>{const m=new MusicEngine();m.setTheremin(true,.5,.5);expect(f.nodes.some(n=>n.triggerAttack.mock.calls.length)).toBe(false);await m.setEnabled(true);m.setTheremin(true,.5,.5);expect(f.nodes.some(n=>n.triggerAttack.mock.calls.length)).toBe(true);m.setTheremin(false);expect(f.nodes.some(n=>n.triggerRelease.mock.calls.length)).toBe(true)});
  it('can start a new engine after the previous view is disposed',async()=>{const old=new MusicEngine();old.dispose();const next=new MusicEngine();await next.setEnabled(true);expect(next.diagnostics).toMatchObject({enabled:true,disposed:false});expect(next.handleEdge({edge:'top',zone:0,velocity:.5,direction:'in'})).not.toBe('')});
});

it('shared-clock deck disable/dispose never stops the other deck transport',async()=>{const a=new MusicEngine({sharedClock:true}),b=new MusicEngine({sharedClock:true});await a.setEnabled(true);await b.setEnabled(true);f.transport.stop.mockClear();await a.setEnabled(false);a.dispose();expect(f.transport.stop).not.toHaveBeenCalled();expect(b.handleEdge({edge:'top',zone:0,velocity:.6,direction:'in'})).not.toBe('');b.dispose()});

it('does not reserve accompaniment events while audio is off',async()=>{const m=new MusicEngine();m.setMode('jungle');m.setAccompaniment(true);m.setRhythm('8 beat');expect(m.activePatternCount).toBe(0);expect(f.transport.scheduleRepeat).not.toHaveBeenCalled();await m.setEnabled(true);expect(m.activePatternCount).toBe(1);await m.setEnabled(false);m.setMode('band');expect(m.activePatternCount).toBe(0);m.dispose()});
