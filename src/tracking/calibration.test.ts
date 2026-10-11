import {describe,it,expect} from 'vitest';
import {CalibrationHold} from './calibration';
describe('elapsed positive calibration evidence',()=>{
  it('finishes at 1000ms, not a frame count',()=>{const h=new CalibrationHold();for(const t of [0,100,400,700,999])h.observe(true,t);expect(h.complete).toBe(false);h.observe(true,1000);expect(h.complete).toBe(true)});
  it('excludes the lost interval and the recovery interval within 500ms grace',()=>{const h=new CalibrationHold();h.observe(true,0);h.observe(true,400);h.observe(false,500);h.observe(true,1000);expect(h.elapsed).toBe(400);h.observe(true,1400);expect(h.elapsed).toBe(800);h.observe(true,1600);expect(h.complete).toBe(true)});
  it('resets unfinished progress after more than 500ms of observed loss',()=>{const h=new CalibrationHold();h.observe(true,0);h.observe(true,300);h.observe(false,400);h.observe(false,700);h.observe(true,901);expect(h.elapsed).toBe(0)});
  it('resets when no fresh samples arrive, without crediting the gap',()=>{const h=new CalibrationHold();h.observe(true,0);h.observe(true,300);h.expire(801);expect(h.elapsed).toBe(0);h.observe(true,900);expect(h.elapsed).toBe(0)});
  it('does not clear completion after long loss or expiry',()=>{const h=new CalibrationHold();for(const t of [0,500,1000])h.observe(true,t);h.observe(false,3000);h.expire(9000);expect(h.complete).toBe(true);expect(h.elapsed).toBe(1000)});
  it.each([500,5000])('supports a configured %sms duration',duration=>{const h=new CalibrationHold(duration);for(let t=0;t<=duration;t+=250)h.observe(true,t);expect(h.complete).toBe(true);expect(h.elapsed).toBe(duration)});
  it('ignores duplicate or out-of-order observations',()=>{const h=new CalibrationHold();h.observe(true,100);h.observe(true,300);h.observe(false,300);h.observe(false,200);h.observe(true,500);expect(h.elapsed).toBe(400)});
  it('rejects invalid durations',()=>{for(const d of [0,499,5001,NaN,Infinity])expect(()=>new CalibrationHold(d)).toThrow()});
});
