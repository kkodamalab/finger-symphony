import {validate,type PresetState} from './types';
const key='finger-symphony-sound-lab-v1';
export function exportPreset(p:PresetState){return JSON.stringify(validate(p),null,2)}
export function importPreset(text:string){if(text.length>100000)throw Error('JSONが大きすぎます');return validate(JSON.parse(text))}
export function loadPresets(store:Pick<Storage,'getItem'>=localStorage):PresetState[]{const text=store.getItem(key);if(!text)return [];const data:unknown=JSON.parse(text);if(!Array.isArray(data)||data.length>200)throw Error('保存データが不正です');const list=data.map(validate);if(list.some(p=>!p.id.startsWith('user-'))||new Set(list.map(p=>p.id)).size!==list.length)throw Error('保存IDが重複または不正です');return list}
export function savePresets(list:PresetState[],store:Pick<Storage,'setItem'>=localStorage){if(list.length>200||list.some(p=>!p.id.startsWith('user-'))||new Set(list.map(p=>p.id)).size!==list.length)throw Error('保存上限またはIDを確認してください');store.setItem(key,JSON.stringify(list.map(validate)))}
export function userCopy(p:PresetState,name:string):PresetState{return validate({...p,id:'user-'+crypto.randomUUID(),name})}
