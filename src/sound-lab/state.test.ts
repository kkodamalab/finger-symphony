import {describe,it,expect} from 'vitest';
import {presets,previewNotes} from './presets';
import {clone,validate,numeric,categories} from './types';
import {macros,readMacro,setMacro} from './mapping';
import {exportPreset,importPreset,loadPresets,savePresets,userCopy} from './storage';
import {EditorState} from './ui';
describe('Sound Lab state and storage',()=>{
 it('provides 29 distinct validated, playable synth definitions across six categories',()=>{expect(presets).toHaveLength(29);expect(new Set(presets.map(p=>JSON.stringify(p.params))).size).toBe(29);expect(new Set(presets.map(p=>p.category))).toEqual(new Set(categories));for(const p of presets){expect(validate(p)).toEqual(p);expect(previewNotes(p.category).length).toBeGreaterThan(0)}});
 it('does not mutate detailed sound data when switching modes repeatedly',()=>{const e=new EditorState();e.detail('mix',.73);e.detail('low',-3);e.detail('decay',2.43);e.detail('release',.89);const before=clone(e.current);e.switchMode('detail');e.switchMode('simple');e.switchMode('detail');expect(e.current).toEqual(before)});
 it.each(Object.keys(macros) as (keyof typeof macros)[])('maps %s to real parameters and round trips the display',key=>{const s=setMacro(presets[0],key,80);expect(readMacro(s,key)).toBe(80);expect(s.params).not.toEqual(presets[0].params);expect(validate(s)).toEqual(s)});
 it('edits only explicit macro fields, preserving unrelated DETAIL work',()=>{const p=clone(presets[0]);p.params.mid=7;p.params.pan=.3;p.params.sustain=.75;const s=setMacro(p,'length',90);expect(s.params).toMatchObject({mid:7,pan:.3,sustain:.75});expect(p.params.release).toBe(.08)});
 it('selects and resets a clone without writing to the factory library',()=>{const e=new EditorState();e.select(presets[12]);e.macro('body',99);expect(e.dirty).toBe(true);e.reset();expect(e.current).toEqual(presets[12]);expect(e.current).not.toBe(presets[12])});
 it('saves, reloads, renames, duplicates, deletes and exports/imports',()=>{let text='';const store={getItem:()=>text,setItem:(_k:string,v:string)=>{text=v}};const p=userCopy(presets[0],'My Snare');savePresets([p],store);expect(loadPresets(store)).toEqual([p]);const copy=userCopy(p,'Copy');savePresets([{...p,name:'Renamed'},copy],store);expect(loadPresets(store).map(x=>x.name)).toEqual(['Renamed','Copy']);expect(importPreset(exportPreset(copy))).toEqual(copy);savePresets([copy],store);expect(loadPresets(store)).toEqual([copy]);savePresets([],store);expect(loadPresets(store)).toEqual([])});
 it.each(['{','null','[]','{"schemaVersion":2}'])('rejects malformed JSON %s',text=>expect(()=>importPreset(text)).toThrow());
 it.each(Object.keys(numeric) as (keyof typeof numeric)[])('rejects dangerous/out of range %s',key=>{for(const value of [NaN,Infinity,numeric[key][1]+1,numeric[key][0]-1]){const p=clone(presets[0]);p.params[key]=value;expect(()=>validate(p)).toThrow()}});
 it('rejects foreign sample URLs, unknown IDs, invalid source and reversed trim',()=>{expect(()=>validate({...presets[0],source:'SAMPLE',sampleId:'https://evil.test/a.wav'})).toThrow();expect(()=>validate({...presets[0],source:'javascript'})).toThrow();expect(()=>validate({...presets[0],id:'../a'})).toThrow();const p=clone(presets[0]);p.params.start=.8;p.params.end=.3;expect(()=>validate(p)).toThrow()});
 it('rejects duplicate and built-in storage IDs',()=>{const p=userCopy(presets[0],'One'),store={setItem:()=>{}};expect(()=>savePresets([p,p],store)).toThrow();expect(()=>savePresets([presets[0]],store)).toThrow()});
});
