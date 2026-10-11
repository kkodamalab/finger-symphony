import {beforeEach,describe,expect,it,vi} from 'vitest';
const f=vi.hoisted(()=>({resolve:vi.fn(),create:vi.fn(),detect:vi.fn(),close:vi.fn()}));
vi.mock('@mediapipe/tasks-vision',()=>({FilesetResolver:{forVisionTasks:f.resolve},HandLandmarker:{createFromOptions:f.create}}));
import {Hands} from './hands';
beforeEach(()=>{vi.clearAllMocks();f.resolve.mockResolvedValue({});f.create.mockResolvedValue({detectForVideo:f.detect,close:f.close});f.detect.mockReturnValue({landmarks:[],handedness:[]})});
describe('Playground Hands lifecycle',()=>{
  it('pins the runtime and returns both handedness labels and all landmarks',async()=>{
    const h=new Hands();await h.init();expect(f.resolve).toHaveBeenCalledWith('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');expect(f.create.mock.calls[0][1]).toMatchObject({numHands:2,runningMode:'VIDEO'});
    const points=Array.from({length:21},()=>({x:.2,y:.3,z:0}));f.detect.mockReturnValue({landmarks:[points,points],handedness:[[{categoryName:'Left'}],[{categoryName:'Right'}]]});expect(h.detect({} as HTMLVideoElement,100)?.map(x=>x.side)).toEqual(['Left','Right']);expect(h.count).toBe(2);
    expect(h.detect({} as HTMLVideoElement,110)).toBeUndefined();expect(f.detect).toHaveBeenCalledTimes(1);
  });
  it('falls back to CPU on initial GPU failure with retained diagnostic',async()=>{f.create.mockRejectedValueOnce(new Error('GPU unavailable'));const h=new Hands();await h.init();expect(h.delegate).toBe('CPU');expect(h.warning).toContain('GPU unavailable')});
  it('reports initialization failure instead of claiming READY',async()=>{f.create.mockRejectedValue(new Error('model unavailable'));const h=new Hands();await expect(h.init()).rejects.toThrow('model unavailable');expect(h.error).toContain('model unavailable');expect(h.landmarker).toBeUndefined()});
  it('reports inference failure and explicitly recovers on CPU',async()=>{const h=new Hands();await h.init();f.detect.mockImplementationOnce(()=>{throw Error('GPU frame failure')});expect(()=>h.detect({} as HTMLVideoElement,100)).toThrow('HAND inference');await h.recover();expect(h.delegate).toBe('CPU');expect(f.close).toHaveBeenCalled()});
  it('closes initialization results that arrive after camera stop/pagehide',async()=>{let resolve!:(value:unknown)=>void;f.create.mockImplementationOnce(()=>new Promise(r=>resolve=r));const h=new Hands(),pending=h.init();await Promise.resolve();h.close();resolve({detectForVideo:f.detect,close:f.close});await pending;expect(f.close).toHaveBeenCalledTimes(1);expect(h.landmarker).toBeUndefined()});
});
