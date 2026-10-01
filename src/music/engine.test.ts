import {describe,expect,it} from 'vitest';import {harmonyForPhase} from './engine';
describe('harmony mapping',()=>{it('maps in phase, quadrature and anti-phase',()=>{expect(harmonyForPhase(0)).toBe('maj7');expect(harmonyForPhase(90)).toBe('sus');expect(harmonyForPhase(180)).toBe('minadd9')});it('uses hysteresis',()=>expect(harmonyForPhase(50,'maj7')).toBe('maj7'))});
