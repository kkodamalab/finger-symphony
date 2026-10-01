import{describe,expect,it}from'vitest';import{displayPointForCamera}from'./camera';
describe('camera coordinates',()=>{it('matches a mirrored preview and leaves rear camera coordinates unchanged',()=>{expect(displayPointForCamera({x:.2,y:.4},true)).toEqual({x:.8,y:.4});expect(displayPointForCamera({x:.2,y:.4},false)).toEqual({x:.2,y:.4})})});
