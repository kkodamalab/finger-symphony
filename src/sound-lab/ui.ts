import './sound-lab.css';
import {categories,clone,numeric,validate,type PresetState,type NumericKey,type Target,type Parameters} from './types';
import {presets} from './presets';
import {macros,readMacro,setMacro,type Macro} from './mapping';
import {exportPreset,importPreset,loadPresets,savePresets,userCopy} from './storage';
import {Preview} from './audio';

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const labels:Partial<Record<NumericKey,string>>={detune:'Detune',octave:'Octave',attack:'Attack',decay:'Decay',sustain:'Sustain',release:'Release',cutoff:'Cutoff',resonance:'Resonance',lfoRate:'LFO Rate',lfoDepth:'LFO Depth',vibrato:'Vibrato',distortion:'Distortion',chorus:'Chorus',mix:'Oscillator Mix',filterAmount:'Filter Envelope Amount',low:'Low EQ',mid:'Mid EQ',high:'High EQ',threshold:'Compressor Threshold',ratio:'Compressor Ratio',reverb:'Reverb Wet',delay:'Delay Time',feedback:'Delay Feedback',pan:'Stereo Pan',start:'Start Offset',end:'Trim End'};
export class EditorState {
  current=clone(presets[0]);baseline=clone(presets[0]);mode:'simple'|'detail'='simple';dirty=false;
  select(p:PresetState){this.current=validate(p);this.baseline=clone(this.current);this.dirty=false}
  switchMode(mode:'simple'|'detail'){this.mode=mode}
  macro(key:Macro,value:number){this.current=setMacro(this.current,key,value);this.dirty=true}
  detail(key:keyof Parameters,value:Parameters[keyof Parameters]){this.current=validate({...this.current,params:{...this.current.params,[key]:value}});this.dirty=true}
  reset(){this.current=clone(this.baseline);this.dirty=false}
}
export function mountSoundLab(apply:(target:Target,p:PresetState|null)=>void,beforeOpen:()=>void){
 const editor=new EditorState(),preview=new Preview();let users:PresetState[]=[];let storageError='';
 try{users=loadPresets()}catch(e){storageError=String(e)}
 const button=document.createElement('button');button.id='open-sound-lab';button.textContent='SOUND LAB';document.querySelector('#modes')!.after(button);
 const dialog=document.createElement('dialog');dialog.id='sound-lab';dialog.setAttribute('aria-labelledby','lab-title');document.body.append(dialog);
 const $=<T extends HTMLElement>(s:string)=>dialog.querySelector<T>(s)!;
 const status=(s:string)=>{$('#lab-message').textContent=s};
 const guard=(fn:()=>void)=>{try{fn()}catch(e){status(String(e))}};
 function summary(){ $('#lab-state').textContent=`${editor.current.name} · ${editor.current.source}版（合成音） · ${editor.dirty?'未保存の変更':editor.current.id.startsWith('builtin-')?'標準・読み取り専用':'保存済み'}` }
 function controls(){
  $('#lab-simple').setAttribute('aria-pressed',String(editor.mode==='simple'));$('#lab-detail').setAttribute('aria-pressed',String(editor.mode==='detail'));
  if(editor.mode==='simple')$('#lab-controls').innerHTML=Object.entries(macros).map(([k,description])=>`<section class="lab-card"><label for="macro-${k}">${k.toUpperCase()}<small>${description}</small></label><output id="value-${k}">${readMacro(editor.current,k as Macro)}</output><input id="macro-${k}" data-macro="${k}" type="range" min="0" max="100" value="${readMacro(editor.current,k as Macro)}"><small>0–100 · 初期値 ${readMacro(editor.baseline,k as Macro)}</small><button data-reset-macro="${k}">初期値に戻す</button></section>`).join('');
  else {
   const select=(key:keyof Parameters,values:string[])=>`<label>${key}<select data-param="${key}" aria-label="${key}">${values.map(v=>`<option ${editor.current.params[key]===v?'selected':''}>${v}</option>`).join('')}</select><small>初期値: ${editor.baseline.params[key]}</small></label>`;
   $('#lab-controls').innerHTML=['OSCILLATOR','AMPLITUDE ENVELOPE','FILTER','MODULATION','EQ / DYNAMICS','EFFECTS',...(editor.current.source==='SYNTH'?[]:['SAMPLE SETTINGS'])].map(group=>`<details class="lab-card" open><summary>${group}</summary>${group==='OSCILLATOR'?select('waveform',['sine','triangle','sawtooth','square']):group==='FILTER'?select('filterType',['lowpass','highpass','bandpass']):group==='MODULATION'?select('lfoDestination',['filter','pitch','pan']):''}${Object.entries(numeric).filter(([,s])=>s[5]===group).map(([key,[min,max,step,,unit]])=>`<label for="param-${key}">${labels[key as NumericKey]??key}<output id="value-${key}">${Number(editor.current.params[key as NumericKey].toFixed(3))} ${unit}</output></label><input id="param-${key}" data-param="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${editor.current.params[key as NumericKey]}"><small>${min}–${max} ${unit} · 初期値 ${editor.baseline.params[key as NumericKey]}</small>`).join('')}</details>`).join('');
  }
  dialog.querySelectorAll<HTMLInputElement>('[data-macro]').forEach(input=>input.oninput=()=>guard(()=>{const k=input.dataset.macro as Macro;editor.macro(k,+input.value);$('#value-'+k).textContent=input.value;preview.update(editor.current);summary()}));
  dialog.querySelectorAll<HTMLButtonElement>('[data-reset-macro]').forEach(b=>b.onclick=()=>guard(()=>{const k=b.dataset.resetMacro as Macro;const fields:Record<Macro,NumericKey[]>={brightness:['cutoff'],body:['low','mix'],attack:['attack'],length:['decay','release'],space:['reverb'],character:['distortion']};fields[k].forEach(f=>editor.detail(f,editor.baseline.params[f]));preview.update(editor.current);controls();summary()}));
  dialog.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-param]').forEach(input=>input.oninput=()=>guard(()=>{const k=input.dataset.param as keyof Parameters;editor.detail(k,input instanceof HTMLInputElement?+input.value:input.value as Parameters[typeof k]);const out=dialog.querySelector('#value-'+k);if(out)out.textContent=input.value+' '+numeric[k as NumericKey][4];preview.update(editor.current);summary()}));
 }
 function choose(p:PresetState){preview.stop();editor.select(p);$<HTMLSelectElement>('#lab-category').value=p.category;fillPresets();$<HTMLSelectElement>('#lab-mine').value=p.id.startsWith('user-')?p.id:'';controls();summary();$<HTMLInputElement>('#lab-name').value=p.name}
 function fillPresets(){const category=$<HTMLSelectElement>('#lab-category').value;$<HTMLSelectElement>('#lab-presets').innerHTML=[...presets,...users].filter(p=>p.category===category).map(p=>`<option value="${p.id}" ${p.id===editor.current.id?'selected':''}>${escape(p.name)} · ${p.source}${p.id.startsWith('user-')?' / MY':''}</option>`).join('');$<HTMLSelectElement>('#lab-mine').innerHTML='<option value="">MY PRESETS — 選択</option>'+users.map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('')}
 function persist(next:PresetState[]){savePresets(next);users=next;fillPresets()}
 function render(){dialog.innerHTML=`<header><div><small>FINGER SYMPHONY / SOUND DESIGN</small><h1 id="lab-title">SOUND LAB</h1></div><button id="lab-close">CLOSE ×</button></header><div class="lab-toolbar"><button id="lab-simple">SIMPLE</button><button id="lab-detail">DETAIL</button><label>カテゴリー<select id="lab-category">${categories.map(c=>`<option>${c}</option>`).join('')}</select></label><label>プリセット<select id="lab-presets"></select></label><button id="lab-preview">PREVIEW ▶</button><button id="lab-stop">STOP ■</button><button id="lab-reset">RESET</button></div><p id="lab-state"></p><p>全29音色はSYNTH版です。楽器・声・自然音の名前は合成音のイメージを表します。</p><div id="lab-controls"></div><footer class="lab-footer"><label>割当先<select id="lab-target"><option value="left">LEFT HIT（左手）</option><option value="right">RIGHT HIT（右手）</option><option value="melody">MELODY（上辺・FREE PLAY）</option></select></label><button id="lab-apply">APPLY TO PLAYGROUND</button><button id="lab-clear">割当を解除</button><p id="lab-assigned">割当はこのPlaygroundセッション内で保持されます。</p><label>保存名<input id="lab-name" maxlength="80" value="Acoustic Snare"></label><button id="lab-save">SAVE AS</button><label>保存した音色<select id="lab-mine"></select></label><button id="lab-load">再読み込み</button><button id="lab-rename">名前変更</button><button id="lab-copy">複製</button><button id="lab-delete">削除</button><button id="lab-import">IMPORT JSON</button><input id="lab-file" type="file" accept="application/json,.json" hidden><button id="lab-export">EXPORT JSON</button></footer><p id="lab-message" role="status" aria-live="polite"></p><p>SIMPLEに戻るだけでは詳細設定は変わりません。BODYはLow EQとMix、LENGTHはDecayとReleaseを操作します。左手・右手の割当とMELODYは上辺で重ねて鳴ります。SOUND LABを開くとPlaygroundの演奏を停止します。戻った後はAUDIO ONで再開してください。</p>`;
  fillPresets();controls();summary();
  $('#lab-close').onclick=()=>dialog.close();
  $('#lab-simple').onclick=()=>{editor.switchMode('simple');controls()};$('#lab-detail').onclick=()=>{editor.switchMode('detail');controls()};
  $<HTMLSelectElement>('#lab-category').onchange=()=>choose(presets.find(p=>p.category===$<HTMLSelectElement>('#lab-category').value)!);
  $<HTMLSelectElement>('#lab-presets').onchange=()=>choose([...presets,...users].find(p=>p.id===$<HTMLSelectElement>('#lab-presets').value)!);
  $('#lab-preview').onclick=()=>{status('試聴中 — STOPで停止');void preview.play(editor.current).catch(e=>status('音声開始エラー: '+String(e)))};
  $('#lab-stop').onclick=()=>{preview.stop();status('停止しました')};$('#lab-reset').onclick=()=>{preview.stop();editor.reset();controls();summary()};
  const assignments:Partial<Record<Target,string>>={};
  $('#lab-apply').onclick=()=>guard(()=>{const t=$<HTMLSelectElement>('#lab-target').value as Target;apply(t,editor.current);assignments[t]=editor.current.name;$('#lab-assigned').textContent=Object.entries(assignments).map(([k,v])=>`${k.toUpperCase()}: ${v}`).join(' / ');status('適用しました。CLOSE後、AUDIO ONで演奏できます')});
  $('#lab-clear').onclick=()=>{const t=$<HTMLSelectElement>('#lab-target').value as Target;apply(t,null);delete assignments[t];$('#lab-assigned').textContent=Object.entries(assignments).map(([k,v])=>`${k}: ${v}`).join(' / ')||'割当なし';status('元のジャンル音色に戻しました')};
  const selectedUser=()=>{const p=users.find(p=>p.id===$<HTMLSelectElement>('#lab-mine').value);if(!p)throw Error('MY PRESETSから選択してください');return p};
  $('#lab-save').onclick=()=>guard(()=>{const p=userCopy(editor.current,$<HTMLInputElement>('#lab-name').value);persist([...users,p]);choose(p);status('保存しました')});
  $('#lab-load').onclick=()=>guard(()=>choose(selectedUser()));
  $('#lab-rename').onclick=()=>guard(()=>{const p=validate({...selectedUser(),name:$<HTMLInputElement>('#lab-name').value});persist(users.map(x=>x.id===p.id?p:x));choose(p);status('名前を変更しました')});
  $('#lab-copy').onclick=()=>guard(()=>{const p=userCopy(selectedUser(),$<HTMLInputElement>('#lab-name').value+' copy');persist([...users,p]);choose(p);status('複製しました')});
  $('#lab-delete').onclick=()=>guard(()=>{const p=selectedUser();persist(users.filter(x=>x.id!==p.id));if(editor.current.id===p.id)choose(presets[0]);status('削除しました')});
  $('#lab-import').onclick=()=>$<HTMLInputElement>('#lab-file').click();$<HTMLInputElement>('#lab-file').onchange=async()=>{const input=$<HTMLInputElement>('#lab-file'),file=input.files?.[0];if(!file)return;try{if(file.size>100000)throw Error('JSONが大きすぎます');const imported=importPreset(await file.text()),p=userCopy(imported,imported.name);persist([...users,p]);choose(p);status('インポートしました')}catch(e){status(String(e))}finally{input.value=''}};
  $('#lab-export').onclick=()=>guard(()=>{const url=URL.createObjectURL(new Blob([exportPreset(editor.current)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='sound-lab-preset.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('JSONを書き出しました')});
  if(storageError)status('保存データを読み込めませんでした: '+storageError);
 }
 render();button.onclick=()=>{beforeOpen();dialog.showModal()};dialog.addEventListener('close',()=>preview.stop());dialog.addEventListener('cancel',()=>preview.stop());
 const onHide=()=>preview.dispose();addEventListener('pagehide',onHide,{once:true});return ()=>{preview.dispose();dialog.remove();button.remove();removeEventListener('pagehide',onHide)};
}
