import {describe,it,expect} from 'vitest';
import {DemoInput} from './demo';
import {defaults,RhythmGame} from './game';

describe('camera-free input',()=>{
  it('moves P2 with keys and clamps both players to the field',()=>{
    const d=new DemoInput();d.moveP1(-2,3);expect(d.positions.P1).toEqual({x:0,y:1});d.keys.add('ArrowRight');for(let i=0;i<100;i++)d.step(.05);expect(d.positions.P2.x).toBe(1);d.keys.clear();d.step(1);expect(d.positions.P2.x).toBe(1);
  });
  it('provides selected hands and symmetric dual cursors',()=>{
    const d=new DemoInput();d.hands.P1='BOTH';d.moveP1(.2,.4);expect(d.cursors(defaults).map(c=>c.x)).toEqual([.2,.8]);expect(d.cursors({...defaults,hand:'R'}).map(c=>c.side)).toEqual(['R']);expect(d.cursors({...defaults,mode:'CO-OP'}).some(c=>c.player==='P2')).toBe(true);
  });
  it.each(['SOLO','CO-OP','BATTLE'] as const)('scores through the same judgment engine in %s',mode=>{
    const settings={...defaults,mode},g=new RhythmGame(settings),d=new DemoInput(),n=g.notes[0];d.hands.P1=n.required[0].side;d.moveP1(n.x,0);g.sample(d.cursors(settings),n.time-20);d.moveP1(n.x,n.y);g.sample(d.cursors(settings),n.time);expect(g.scores.P1.score).toBe(1000);g.expire(settings.duration*1000+1000);expect(g.exportEvents().every(e=>e.judgement!=='UNPLAYED')).toBe(true);
  });
});
