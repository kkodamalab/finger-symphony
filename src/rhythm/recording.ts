import type {PlayerId,Side,Status} from '../tracking/duo';
import type {GameEvent} from './game';
export type TrackingRow={timestamp:number;player_id:PlayerId;hand_side:Side;x:number|null;y:number|null;tracking_status:Status;confidence:number|null;fps:number|null;input_source:'CAMERA'|'DEMO'};
export const trackingColumns=['timestamp','player_id','hand_side','x','y','tracking_status','confidence','fps','input_source'] as const;
export const eventColumns=['target_id','player_id','hand_side','target_x','target_y','scheduled_time','hit_time','timing_error_ms','spatial_error','judgement','score','observed_timestamp'] as const;
export function csv<T>(rows:T[],columns:readonly (keyof T)[]){
  const cell=(value:unknown)=>value===null||value===undefined?'':`"${String(value).replaceAll('"','""')}"`;
  return columns.join(',')+'\r\n'+rows.map(row=>columns.map(k=>cell(row[k])).join(',')).join('\r\n');
}
export class SessionRecording {
  tracking:TrackingRow[]=[];
  events:GameEvent[]=[];
  metadata:Record<string,unknown>;
  constructor(metadata:Record<string,unknown>){this.metadata=structuredClone(metadata)}
  finish(events:GameEvent[],completed:boolean){this.events=structuredClone(events);this.metadata.completed=completed;this.metadata.ended_at=new Date().toISOString()}
  trackingCsv(){return csv(this.tracking,trackingColumns)}
  eventsCsv(){return csv(this.events,eventColumns)}
  json(){return JSON.stringify(this.metadata,null,2)}
}
export function downloadFile(name:string,content:string,type:string){
  const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
