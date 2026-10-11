import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DuoClient} from './duo-client';
class FakeWorker {
  static latest:FakeWorker;
  onmessage?:({data}:{data:any})=>void;onerror?:({message}:{message:string})=>void;
  postMessage=vi.fn();terminate=vi.fn();
  constructor(){FakeWorker.latest=this}
  reply(data:unknown){this.onmessage?.({data})}
}
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('Worker',FakeWorker);vi.stubGlobal('createImageBitmap',vi.fn(async()=>({close:vi.fn()})))});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});
async function ready(){const client=new DuoClient(),init=client.init();FakeWorker.latest.reply({type:'ready',delegate:'GPU',warning:''});await init;return client}
describe('inference worker backpressure',()=>{
  it('never queues another capture while a frame is running',async()=>{
    const client=await ready(),video={} as HTMLVideoElement,pending=client.detect(video,100);await Promise.resolve();expect(client.busy).toBe(true);
    expect(await client.detect(video,110)).toBeUndefined();expect(createImageBitmap).toHaveBeenCalledTimes(1);expect(FakeWorker.latest.postMessage).toHaveBeenCalledTimes(2);
    FakeWorker.latest.reply({type:'result',frame:{timestamp:100,poses:[],hands:[]}});expect((await pending)?.timestamp).toBe(100);expect(client.busy).toBe(false);client.close();
  });
  it('terminates a stuck inference at five seconds and reports it',async()=>{
    const client=await ready(),pending=client.detect({} as HTMLVideoElement,100);await Promise.resolve();const rejected=expect(pending).rejects.toThrow('TIMEOUT');vi.advanceTimersByTime(5000);await rejected;expect(FakeWorker.latest.terminate).toHaveBeenCalled();expect(client.busy).toBe(false);
  });
  it('does not submit a bitmap captured before close/reset',async()=>{
    const client=await ready();let release!:(x:ImageBitmap)=>void;vi.mocked(createImageBitmap).mockImplementationOnce(()=>new Promise<ImageBitmap>(r=>release=r));
    const pending=client.detect({} as HTMLVideoElement,100),bitmap={close:vi.fn()};client.close();release(bitmap as unknown as ImageBitmap);expect(await pending).toBeUndefined();expect(bitmap.close).toHaveBeenCalled();expect(FakeWorker.latest.postMessage).toHaveBeenCalledTimes(1);
  });
  it('surfaces worker exceptions without leaving the frame gate locked',async()=>{
    const client=await ready(),pending=client.detect({} as HTMLVideoElement,100);await Promise.resolve();FakeWorker.latest.reply({type:'error',error:'HAND推論失敗 (GPU)'});await expect(pending).rejects.toThrow('HAND');expect(client.busy).toBe(false);client.close();
  });
});
