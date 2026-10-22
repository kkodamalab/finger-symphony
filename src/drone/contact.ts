import type {Edge,Frame,Point} from '../performance/frame';
import type {FieldSettings} from '../performance/settings';
import {EDGES} from './settings';
/** Aggregate all visible fingertips. Missing tracking never constitutes a release. */
export class DroneContactTracker{
 private states=new Map<Edge,{held:boolean;since?:number;away?:number;last:number;owners:Set<string>}>();
 reset(){this.states.clear()}
 update(points:(Point & {owner?:string})[],frame:Frame,now:number,settings:FieldSettings,hysteresis=.012,cooldown=250):Edge[]{
  if(!points.length){for(const s of this.states.values()){s.since=undefined;s.away=undefined}return []}
  const result:Edge[]=[];
  for(const edge of EDGES){let s=this.states.get(edge);if(!s){s={held:false,last:-Infinity,owners:new Set()};this.states.set(edge,s)}
   const distances=points.map(p=>{const horizontal=edge==='top'||edge==='bottom';const along=horizontal?p.x:p.y,start=horizontal?frame.x:frame.y,length=horizontal?frame.width:frame.height;const boundary=edge==='top'?frame.y:edge==='bottom'?frame.y+frame.height:edge==='left'?frame.x:frame.x+frame.width;return Math.hypot(Math.max(start-along,0,along-start-length),(horizontal?p.y:p.x)-boundary)});const distance=Math.min(...distances);
   if(distance<=settings.contactDistance){s.away=undefined;points.forEach((p,i)=>{if(distances[i]<=settings.contactDistance)s!.owners.add(p.owner??'pointer')});if(!s.held){s.since??=now;if(now-s.since>=settings.contactTime&&now-s.last>=cooldown){s.held=true;s.last=now;result.push(edge)}}}
   else {s.since=undefined;if(s.held&&[...s.owners].some(owner=>!points.some(p=>(p.owner??'pointer')===owner))){s.away=undefined;continue}if(distance>settings.contactDistance+hysteresis){s.away??=now;if(now-s.away>=120){s.held=false;s.owners.clear()}}else s.away=undefined}
  }return result;
 }
}
