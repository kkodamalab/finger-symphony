import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({files:vi.fn(async()=>({})),poseCreate:vi.fn(),handCreate:vi.fn(),poseDetect:vi.fn(),handDetect:vi.fn(),poseClose:vi.fn(),handClose:vi.fn()}));
vi.mock('@mediapipe/tasks-vision',()=>({FilesetResolver:{forVisionTasks:mock.files},PoseLandmarker:{createFromOptions:mock.poseCreate},HandLandmarker:{createFromOptions:mock.handCreate}}));
import {DuoLandmarker} from './duo';
beforeEach(()=>{vi.clearAllMocks();mock.poseCreate.mockResolvedValue({detectForVideo:mock.poseDetect,close:mock.poseClose});mock.handCreate.mockResolvedValue({detectForVideo:mock.handDetect,close:mock.handClose});mock.poseDetect.mockReturnValue({landmarks:[]});mock.handDetect.mockReturnValue({landmarks:[]})});
describe('MediaPipe execution',()=>{
  it('executes Pose and Hand once on the same image/timestamp with four hands configured',async()=>{
    const model=new DuoLandmarker();await model.init('GPU',true);expect(mock.files).toHaveBeenCalledWith(expect.stringContaining('0.10.35'),true);expect(mock.handCreate).toHaveBeenCalledWith({},expect.objectContaining({numHands:4,runningMode:'VIDEO'}));expect(mock.poseCreate).toHaveBeenCalledWith({},expect.objectContaining({numPoses:2}));
    const frame={} as ImageBitmap,result=model.detect(frame,123);expect(mock.poseDetect).toHaveBeenCalledWith(frame,123);expect(mock.handDetect).toHaveBeenCalledWith(frame,123);expect(mock.poseDetect.mock.invocationCallOrder[0]).toBeLessThan(mock.handDetect.mock.invocationCallOrder[0]);expect(result?.poseMs).toBeGreaterThanOrEqual(0);expect(result?.handMs).toBeGreaterThanOrEqual(0);
  });
  it('falls back after a GPU model load error and retains the diagnostic',async()=>{
    mock.handCreate.mockRejectedValueOnce(new Error('GPU unavailable'));const model=new DuoLandmarker();await model.init('GPU',true);expect(model.delegate).toBe('CPU');expect(model.warning).toContain('GPU unavailable');expect(mock.poseClose).toHaveBeenCalled();
  });
  it('reports a Hand runtime error rather than returning zero detections',async()=>{
    const model=new DuoLandmarker();await model.init();mock.handDetect.mockImplementationOnce(()=>{throw new Error('device lost')});expect(()=>model.detect({} as ImageBitmap,100)).toThrow('HAND推論失敗 (GPU): Error: device lost');
  });
  it('honors explicit CPU recovery without trying GPU again',async()=>{
    const model=new DuoLandmarker();await model.init('CPU',true);expect(mock.handCreate).toHaveBeenCalledTimes(1);expect(mock.handCreate.mock.calls[0][1].baseOptions.delegate).toBe('CPU');
  });
});
