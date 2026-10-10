import type {Crossing,Edge,Frame,Point} from './frame';
export const DEFAULT_FRAME:Frame={x:.18,y:.2,width:.64,height:.6};
export type FieldSettings={contactDistance:number;contactTime:number;edgeSegments:number};
export const DEFAULT_FIELD_SETTINGS:FieldSettings={contactDistance:.02,contactTime:100,edgeSegments:6};
export const clampSegments=(n:number)=>Math.max(1,Math.min(8,Math.round(n)));
export function loadFieldSettings():FieldSettings{
  try {const data=JSON.parse(localStorage.getItem('finger-symphony-field-settings')||'{}');return {contactDistance:Number.isFinite(data.contactDistance)?Math.max(.005,Math.min(.08,data.contactDistance)):.02,contactTime:Number.isFinite(data.contactTime)?Math.max(0,Math.min(600,data.contactTime)):100,edgeSegments:clampSegments(Number.isFinite(data.edgeSegments)?data.edgeSegments:6)}}catch{return {...DEFAULT_FIELD_SETTINGS}}
}
export function frameFromPoints(points:Point[]):Frame|undefined{
  if(points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);const x=Math.max(0,Math.min(...xs)),y=Math.max(0,Math.min(...ys));const width=Math.min(1-x,Math.max(...xs)-x),height=Math.min(1-y,Math.max(...ys)-y);
  return width>=.2&&height>=.2?{x,y,width,height}:undefined;
}
export class ContactTracker{
  private active=new Map<Edge,{since:number;fired:boolean}>();
  reset(){this.active.clear()}
  update(p:Point,f:Frame,now:number,settings:FieldSettings):Crossing[]{
    const edges:[Edge,number,number][]=[['top',Math.abs(p.y-f.y),(p.x-f.x)/f.width],['bottom',Math.abs(p.y-f.y-f.height),(p.x-f.x)/f.width],['left',Math.abs(p.x-f.x),(p.y-f.y)/f.height],['right',Math.abs(p.x-f.x-f.width),(p.y-f.y)/f.height]];
    const result:Crossing[]=[];
    for(const [edge,d,pos] of edges){if(d>settings.contactDistance||pos<0||pos>1){this.active.delete(edge);continue}let state=this.active.get(edge);if(!state){state={since:now,fired:false};this.active.set(edge,state)}if(!state.fired&&now-state.since>=settings.contactTime){state.fired=true;result.push({edge,point:p,position:pos,progress:1})}}
    return result;
  }
}
