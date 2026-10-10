import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>({context:{currentTime:10,state:'running',outputLatency:.02,baseLatency:.01,getOutputTimestamp:()=>({contextTime:13.25,performanceTime:1000})},start:vi.fn(async()=>{}),begin:vi.fn(),stop:vi.fn(),volume:vi.fn(),hit:vi.fn(),dispose:vi.fn(),construct:vi.fn()}));
vi.mock('tone',()=>({start:f.start,getContext:()=>({rawContext:f.context})}));
vi.mock('../music/engine',()=>({MusicEngine:class{constructor(){f.construct()}beginReach=f.begin;stopReach=f.stop;reachVolume=f.volume;reachHit=f.hit;dispose=f.dispose}}));
import {RhythmAudio} from './audio';
beforeEach(()=>{vi.clearAllMocks();f.context.currentTime=10;f.context.getOutputTimestamp=()=>({contextTime:13.25,performanceTime:1000});f.start.mockResolvedValue()});
afterEach(()=>vi.restoreAllMocks());
describe('Tone shared audible clock and lifecycle',()=>{
  it('uses capture time independently of inference completion',async()=>{const a=new RhythmAudio();await a.start(100,10);vi.spyOn(performance,'now').mockReturnValue(1300);expect(a.at(1080)).toBeCloseTo(80);a.stop()});
  it('uses latency fallback when no output timestamp is valid',async()=>{const a=new RhythmAudio();f.context.getOutputTimestamp=()=>({contextTime:0,performanceTime:0});await a.start(100,10);f.context.currentTime=13.25;vi.spyOn(performance,'now').mockReturnValue(1000);expect(a.at(1080)).toBeCloseTo(60)});
  it('reuses one engine and schedules the selected genre at the countdown origin',async()=>{const a=new RhythmAudio();await a.start(100,30,'jungle');await a.start(80,20,'dub');expect(f.construct).toHaveBeenCalledTimes(1);expect(f.begin).toHaveBeenLastCalledWith('dub',80,13.25);expect(f.stop).toHaveBeenCalled();a.close();expect(f.dispose).toHaveBeenCalledOnce()});
  it('preserves volume/mute and separate player hit identities',async()=>{const a=new RhythmAudio();a.setVolume(.2,true);await a.start(100,10);expect(f.volume).toHaveBeenLastCalledWith(.2,true);a.hit('P1','PERFECT');a.hit('P2','GOOD');expect(f.hit.mock.calls).toEqual([['P1','PERFECT'],['P2','GOOD']])});
  it('does not start audio after a pending start has been cancelled',async()=>{let release!:()=>void;f.start.mockImplementationOnce(()=>new Promise<void>(r=>release=r));const a=new RhythmAudio(),pending=a.start(100,10);a.stop();release();await pending;expect(f.begin).not.toHaveBeenCalled()});
});
