import type {Crossing,Edge,Frame,Point} from './frame';

export const DEFAULT_FRAME:Frame={x:.18,y:.2,width:.64,height:.6};
export type FieldSettings={contactDistance:number;contactTime:number;edgeSegments:number};
export const DEFAULT_FIELD_SETTINGS:FieldSettings={contactDistance:.018,contactTime:100,edgeSegments:6};
export const clampSegments=(value:number)=>Math.max(1,Math.min(8,Math.round(value)));

export function frameFromPoints(points:Point[]):Frame|undefined{
  if(points.length<4)return;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.max(0,Math.min(...xs)),y=Math.max(0,Math.min(...ys)),right=Math.min(1,Math.max(...xs)),bottom=Math.min(1,Math.max(...ys));
  if(right-x<.08||bottom-y<.08)return;return{x,y,width:right-x,height:bottom-y};
}

const nearestEdge=(point:Point,frame:Frame,distance:number):Crossing|undefined=>{const entries:{edge:Edge;distance:number;position:number;point:Point}[]=[
  {edge:'top' as const,distance:Math.abs(point.y-frame.y),position:(point.x-frame.x)/frame.width,point:{x:point.x,y:frame.y}},
  {edge:'bottom' as const,distance:Math.abs(point.y-frame.y-frame.height),position:(point.x-frame.x)/frame.width,point:{x:point.x,y:frame.y+frame.height}},
  {edge:'left' as const,distance:Math.abs(point.x-frame.x),position:(point.y-frame.y)/frame.height,point:{x:frame.x,y:point.y}},
  {edge:'right' as const,distance:Math.abs(point.x-frame.x-frame.width),position:(point.y-frame.y)/frame.height,point:{x:frame.x+frame.width,y:point.y}},
].filter(x=>x.position>=0&&x.position<=1).sort((a,b)=>a.distance-b.distance);const hit=entries[0];return hit&&hit.distance<=distance?{edge:hit.edge,point:hit.point,position:hit.position,progress:1}:undefined};

export class ContactTracker{
  private edge?:Edge;private enteredAt=0;private lastFired=new Map<Edge,number>();private fired=false;
  reset(){this.edge=undefined;this.fired=false}
  markTriggered(edge:Edge,now:number){this.lastFired.set(edge,now)}
  update(point:Point,frame:Frame,now:number,settings:FieldSettings,cooldownMs:number){const hit=nearestEdge(point,frame,settings.contactDistance);if(!hit){this.reset();return}if(hit.edge!==this.edge){this.edge=hit.edge;this.enteredAt=now;this.fired=false;return}if(this.fired||now-this.enteredAt<settings.contactTime||now-(this.lastFired.get(hit.edge)??-Infinity)<cooldownMs)return;this.fired=true;this.lastFired.set(hit.edge,now);return hit}
}
