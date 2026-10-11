import {describe,it,expect} from 'vitest';
import {SessionRecording,csv} from './recording';
import {defaults,RhythmGame} from './game';

describe('research exports',()=>{
  it('exports exact timestamps and leaves unobserved data blank',()=>{
    const r=new SessionRecording({input_source:'CAMERA'});r.tracking.push({timestamp:123456789.123,player_id:'P1',hand_side:'L',x:null,y:null,tracking_status:'LOST',confidence:null,fps:20,input_source:'CAMERA'});
    expect(r.trackingCsv()).toContain('"123456789.123","P1","L",,,"LOST",,"20","CAMERA"');
  });
  it('retains entry measurements and distinguishes misses from unplayed notes',()=>{
    const g=new RhythmGame(defaults),n=g.notes[0],c={...n.required[0],x:n.x,y:n.y,status:'TRACKING' as const};
    g.sample([{...c,y:0}],n.time-20);g.sample([c],n.time+15,16/9,123456.78);g.expire(g.notes[1].time+251);
    const events=g.exportEvents();expect(events[0]).toMatchObject({hit_time:n.time+15,timing_error_ms:15,spatial_error:0,observed_timestamp:123456.78,score:1000});expect(events[1]).toMatchObject({judgement:'MISS',hit_time:null,spatial_error:null,score:0});expect(events.at(-1)?.judgement).toBe('UNPLAYED');
  });
  it('snapshots metadata so later UI changes cannot rewrite the session',()=>{
    const meta={bpm:100,camera_settings:{mirror:true}},r=new SessionRecording(meta);meta.camera_settings.mirror=false;r.finish([],false);expect(JSON.parse(r.json()).camera_settings.mirror).toBe(true);expect(JSON.parse(r.json()).completed).toBe(false);
  });
  it('escapes CSV delimiters and quotes',()=>expect(csv([{a:'a,"b"'}],['a'])).toBe('a\r\n"a,""b"""'));
});
