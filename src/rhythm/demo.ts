import type {Cursor,Settings} from './game';
import type {PlayerId,Side} from '../tracking/duo';

/** Explicit synthetic input. No camera confidence or anatomical landmarks are fabricated. */
export class DemoInput {
  positions={P1:{x:.25,y:.7},P2:{x:.75,y:.7}};
  hands:Record<PlayerId,Side|'BOTH'>={P1:'L',P2:'L'};
  keys=new Set<string>();
  moveP1(x:number,y:number){this.positions.P1={x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}}
  step(seconds:number){
    const dt=Math.min(.05,Math.max(0,seconds)),p=this.positions.P2;
    p.x=Math.max(0,Math.min(1,p.x+((this.keys.has('ArrowRight')?1:0)-(this.keys.has('ArrowLeft')?1:0))*dt*.55));
    p.y=Math.max(0,Math.min(1,p.y+((this.keys.has('ArrowDown')?1:0)-(this.keys.has('ArrowUp')?1:0))*dt*.75));
  }
  cursors(settings:Settings):Cursor[]{
    return (settings.mode==='SOLO'?['P1']:['P1','P2'] as PlayerId[]).flatMap(id=>{
      const player=id as PlayerId,p=this.positions[player],selected=settings.mode==='SOLO'&&settings.hand!=='BOTH'?settings.hand:this.hands[player];
      const sides:Side[]=selected==='BOTH'?['L','R']:[selected];
      return sides.map((side,i)=>({player,side,status:'TRACKING' as const,x:i===0?p.x:Math.max(0,Math.min(1,2*(settings.mode==='SOLO'?.5:player==='P1'?.25:.75)-p.x)),y:p.y}));
    });
  }
}
