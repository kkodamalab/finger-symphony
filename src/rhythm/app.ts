import './reach.css';
import {CameraSession,displayPointForCamera} from '../input/camera';
import {IdentityTracker,type DuoFrame,type Point,type Side} from '../tracking/duo';
import {DuoClient} from '../tracking/duo-client';
import {defaults,RhythmGame,validate,type Cursor,type Settings} from './game';
import {RhythmAudio} from './audio';
import {DemoInput} from './demo';
import {SessionRecording,downloadFile} from './recording';
import {modeNames,type MusicMode} from '../music/modes';

const app=document.querySelector<HTMLDivElement>('#app')!;
const select=(id:string,label:string,values:string[])=>`<label>${label}<select id="${id}">${values.map(v=>`<option>${v}</option>`).join('')}</select></label>`;
const input=(id:string,label:string,value:number,min:number,max:number,step=1)=>`<label>${label}<input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
app.innerHTML=`<main class="reach-app">
  <header><div><small>FINGER SYMPHONY / PHASE 02 + 03</small><h1>RHYTHM REACH <span>2D</span></h1></div><a href="?view=playground">MUSIC PLAYGROUND ↗</a></header>
  <nav aria-label="Screen"><button id="game-tab" aria-pressed="true">RHYTHM REACH</button><button id="demo-tab" aria-pressed="false">DUO TRACKING DEMO</button></nav>
  <div class="workspace"><section class="play-area">
    <div class="scorebar"><div class="p1">P1 <b id="p1-score">0</b><small id="p1-combo">COMBO 0</small></div><div><b id="tempo">100 BPM</b><small id="remaining">30.0 SEC</small></div><div class="p2">P2 <b id="p2-score">0</b><small id="p2-combo">COMBO 0</small></div></div>
    <div id="reach-stage"><video id="reach-video" playsinline muted></video><canvas id="reach-canvas"></canvas><div id="countdown" aria-live="polite"></div><div id="stage-caption">REACH • RETURN • REPEAT</div></div>
    <p id="message" role="status">カメラを起動し、肩と両手が映る位置に立ってください。</p>
    <div class="toolbar"><button id="camera-start">START CAMERA</button><button id="camera-stop">STOP CAMERA</button><button id="recover">RECOVER TRACKING</button><button id="recalibrate">再キャリブレーション</button></div>
    <section id="results" hidden aria-live="polite"></section>
    <section class="telemetry"><h2>SESSION DATA</h2><p id="recording-status">セッション開始後に記録します。入力源をsession.jsonとCSVに保存します。</p><div class="toolbar"><button id="save-tracking" disabled>tracking.csv</button><button id="save-events" disabled>events.csv</button><button id="save-session" disabled>session.json</button></div></section>
    <section class="telemetry"><h2>LIVE TRACKING</h2><p id="tracking-info">0 PEOPLE · 0 HANDS · 0 FPS</p><p id="inference-info">POSE / HAND: 未計測</p><div id="hands-info"></div><p id="calibration-progress">CALIBRATION PROGRESS 0%</p><p id="tracking-reason" role="status"></p><p id="camera-info">CAMERA: IDLE · TRACKING: IDLE</p></section>
  </section><aside>
    <fieldset id="session-settings"><legend>01 / SESSION</legend>
      ${select('input-source','入力源',['CAMERA','DEMO'])}
      ${select('player-count','キャリブレーション',['SOLO','DUO'])}
      ${select('game-mode','ゲームモード',['SOLO','CO-OP','BATTLE'])}
      ${select('active-hand','使用する手（SOLO）',['BOTH','L','R'])}
      <p id="demo-help" hidden>DEMO（合成入力）: P1はマウス／タッチ、P2は矢印キー。Q/EでP1のL/R、J/KでP2のL/R、B/Uで各プレイヤーの両手（左右対称）を操作。</p>
      <p id="calibration-help">両手を肩より高く上げて1秒間保持してください。</p>
      <p id="calibration-status">未登録</p>
    </fieldset>
    <fieldset id="game-settings"><legend>02 / GAME SETTINGS</legend>
      ${input('reach-bpm','BPM',100,60,160)}${input('duration','時間（秒）',30,10,180)}
      ${select('difficulty','難易度',['EASY','NORMAL','HARD'])}
      ${select('layout','配置バリエーション',['MIXED','HORIZONTAL','VERTICAL'])}
      ${input('max-targets','同時表示数（BATTLEは偶数に制限）',4,1,4)}
      ${input('radius','ターゲット半径（画面の高さに対する%）',7,3.5,12,.5)}
      ${input('reach','リーチ範囲（%）',75,20,100,5)}
      <details><summary>判定窓・遅延補正</summary>${input('perfect','PERFECT ±ms',80,1,500)}${input('great','GREAT ±ms',160,1,500)}${input('good','GOOD ±ms',250,1,500)}${input('latency','取得遅延補正 ms（正値＝過去へ補正）',0,-300,300,5)}<p>推論時間は自動的に除外します。カメラの取得遅延は端末ごとに調整できます。</p></details>
    </fieldset>
    <button id="play" class="start-game" disabled>START</button><button id="end" disabled>ゲームを中断</button>
    <fieldset><legend>MUSIC / TONE.JS</legend>${select('music-mode','ジャンル',modeNames.map(x=>x.toUpperCase()))}<label>音量<input id="reach-volume" type="range" min="0" max="1" step=".01" value=".65"></label><label class="check"><input id="reach-mute" type="checkbox">ミュート</label></fieldset>
    <fieldset id="demo-controls" hidden><legend>DEMO HANDS</legend>${select('demo-p1','P1 操作する手',['L','R','BOTH'])}${select('demo-p2','P2 操作する手',['L','R','BOTH'])}<p>両手モードでは、2つ目のカーソルはプレイヤーの中心線に対して左右対称に動きます。</p></fieldset>
    <fieldset><legend>03 / DISPLAY & CAMERA</legend>
      <label class="check"><input type="checkbox" id="background" checked>カメラ背景</label>
      <label class="check"><input type="checkbox" id="body-lines" checked>身体スケルトン</label>
      <label class="check"><input type="checkbox" id="hand-lines" checked>手指スケルトン</label>
      <label class="check"><input type="checkbox" id="mirror" checked>ミラー表示</label>
      <label>カメラ<select id="camera-device"><option value="">既定のカメラ</option></select></label><button id="camera-switch">カメラ切替</button>
    </fieldset>
    <p class="privacy">映像はブラウザー内で処理されます。青＝P1、赤＝P2。L/Rは本人の左手／右手です。</p>
  </aside></div></main>`;

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const video=$<HTMLVideoElement>('reach-video'),canvas=$<HTMLCanvasElement>('reach-canvas'),ctx=canvas.getContext('2d')!;
const value=(id:string)=>$(id) as HTMLInputElement;
const model=new DuoClient(),audio=new RhythmAudio();
const demoInput=new DemoInput();let recording:SessionRecording|undefined,lastDemoTime=0,lastRecordTime=0,soundedEvents=0;
const synthetic=()=>value('input-source').value==='DEMO';
let identity=new IdentityTracker(1),frame:DuoFrame|undefined,game:RhythmGame|undefined;
let playing=false,starting=false,trackingReady=false,recovering=false,mirror=true,demo=false;
let lastVideo=-1,lastInference=-Infinity,lastSuccess=0,fpsAt=performance.now(),renders=0,inferences=0,renderFps=0,trackingFps=0,inferenceMs=0;
let cameraGeneration=0,recoveryAttempts=0,nextRecovery=0;
let startGeneration=0;
let poseMs:number|undefined,handMs:number|undefined,diagnosticError='',registrationResetAt=performance.now(),frameReceivedAt=0;
const session=new CameraSession({
  video,
  requestStream:()=>navigator.mediaDevices.getUserMedia({video:{...(value('camera-device').value?{deviceId:{exact:value('camera-device').value}}:{}),width:{ideal:960},height:{ideal:540}},audio:false}),
  initializeTracking:async()=>{await model.init()},
  onReport:report=>{
    $('camera-info').textContent=`CAMERA: ${report.camera} · TRACKING: ${report.tracking}${report.message?' · '+report.message:''}`;
    trackingReady=report.tracking==='READY';
    if(trackingReady){lastSuccess=performance.now();registrationResetAt=lastSuccess;recoveryAttempts=0}
    if(report.camera==='ERROR'||report.tracking==='ERROR')message(report.message??'カメラまたはモデルを開始できませんでした。');
    if(report.camera==='IDLE')trackingReady=false;
  },
  onCameraReady:()=>{session.setPresentation(value('background').checked,mirror);void listCameras()},
});

function message(text:string){$('message').textContent=text}
function settings():Settings{return {...defaults,mode:value('game-mode').value as Settings['mode'],bpm:+value('reach-bpm').value,duration:+value('duration').value,difficulty:value('difficulty').value as Settings['difficulty'],radius:+value('radius').value/100,reach:+value('reach').value/100,hand:identity.count===2?'BOTH':value('active-hand').value as Settings['hand'],windows:{perfect:+value('perfect').value,great:+value('great').value,good:+value('good').value},latency:synthetic()?0:+value('latency').value,layout:value('layout').value as Settings['layout'],maxTargets:+value('max-targets').value}}
function calibratedZones():Settings['zones']{
  if(synthetic()||!frame)return undefined;
  const entries=frame.players.map(p=>{
    const points=p.pose.map(q=>displayPointForCamera(q,mirror)),center={x:(points[11].x+points[12].x)/2,y:(points[11].y+points[12].y)/2+.08};
    const length=(a:number,b:number)=>Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);
    const arms=identity.activeHand==='L'?[[11,13,15]]:identity.activeHand==='R'?[[12,14,16]]:[[11,13,15],[12,14,16]];
    if(arms.flat().some(i=>(p.pose[i].visibility??0)<.6))throw new Error('肩・肘・手首が見える位置に立ってSTARTを押してください。');
    const arm=Math.min(...arms.map(([a,b,c])=>length(a,b)+length(b,c)));
    return [p.id,{...center,rx:Math.min(.4,arm*.8),ry:Math.min(.32,arm*.8)}] as const;
  });
  const zones=Object.fromEntries(entries) as NonNullable<Settings['zones']>;
  if(zones.P1&&zones.P2){const rx=Math.min(zones.P1.rx,zones.P2.rx),ry=Math.min(zones.P1.ry,zones.P2.ry);for(const z of Object.values(zones)){z.rx=rx;z.ry=ry}}
  return zones;
}
function resetRegistration(){
  if(playing||starting)endGame(false);
  identity=new IdentityTracker(value('player-count').value==='DUO'?2:1,mirror,value('player-count').value==='DUO'?'BOTH':value('active-hand').value as 'BOTH'|Side);
  frame=undefined;lastVideo=-1;game?.invalidate();$('results').hidden=true;
  registrationResetAt=performance.now();frameReceivedAt=0;diagnosticError='';poseMs=undefined;handMs=undefined;inferences=0;trackingFps=0;
  $('calibration-help').textContent=identity.count===2?'画面左がP1、右がP2。2人とも両手を上げて1秒間保持してください。':identity.activeHand==='BOTH'?'両手を肩より高く上げて1秒間保持してください。':`${identity.activeHand==='L'?'左手':'右手'}を肩より高く上げて1秒間保持してください。`;
  message('キャリブレーション中。認識が安定するとSTARTが有効になります。');
  if(synthetic())message('DEMO INPUT — 実カメラではありません。STARTでカメラなし検証を開始できます。');
}
async function listCameras(){
  try{
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'),select=$<HTMLSelectElement>('camera-device');
    const selected=select.value;select.replaceChildren(new Option('既定のカメラ',''),...devices.map((d,i)=>new Option(d.label||`カメラ ${i+1}`,d.deviceId)));select.value=selected;
  }catch(error){message(`カメラ一覧を取得できません: ${String(error)}`)}
}
function stopCamera(){cameraGeneration++;session.stop();model.close();trackingReady=false;recovering=false;frame=undefined;identity.reset();endGame(false)}
async function recover(){
  if(recovering||!session.active)return;
  recovering=true;trackingReady=false;frame=undefined;identity.reset();game?.invalidate();
  const generation=cameraGeneration;message('TRACKING: RECOVERING');
  try{await model.init('CPU');if(generation===cameraGeneration&&session.active){trackingReady=true;lastSuccess=performance.now();registrationResetAt=lastSuccess;lastVideo=-1;message('CPUで追跡を復旧しました。両手を上げて再登録してください。')}}
  catch(error){if(generation===cameraGeneration)message(`追跡復旧に失敗: ${String(error)}。RECOVER TRACKINGで再試行できます。`)}
  finally{if(generation===cameraGeneration){recovering=false;nextRecovery=performance.now()+5000}}
}
function cursors():Cursor[]{return synthetic()?demoInput.cursors(playing&&game?game.settings:settings()):frame?.hands.filter(h=>h.points[8]).map(h=>({...displayPointForCamera(h.points[8],mirror),player:h.player,side:h.side,status:identity.calibrated?h.status:'UNCERTAIN'}))??[]}
function currentReady(){
  if(synthetic())return true;
  if(!frame||performance.now()-frame.timestamp>750||!identity.calibrated||!trackingReady||identity.needsRegistration)return false;
  return frame.players.length===identity.count&&frame.players.every(p=>p.status==='TRACKING')&&frame.hands.filter(h=>identity.activeHand==='BOTH'||h.side===identity.activeHand).every(h=>h.status==='TRACKING');
}
function lock(locked:boolean){$<HTMLFieldSetElement>('session-settings').disabled=locked;$<HTMLFieldSetElement>('game-settings').disabled=locked;value('mirror').disabled=locked;$<HTMLButtonElement>('end').disabled=!locked}
async function startGame(){
  if(!currentReady()||starting||playing)return;
  const request=++startGeneration;
  try{
    const s={...settings(),zones:calibratedZones()};validate(s);starting=true;lock(true);$<HTMLButtonElement>('play').disabled=true;
    const musicMode=value('music-mode').value.toLowerCase() as MusicMode;
    const generation=cameraGeneration;await audio.start(s.bpm,s.duration,musicMode);
    if(request!==startGeneration)return;
    if(!starting||generation!==cameraGeneration){audio.stop();return}
    if(!currentReady())throw new Error('認識状態を確認してから、もう一度STARTを押してください。');
    game=new RhythmGame(s);playing=true;starting=false;soundedEvents=0;lastRecordTime=0;
    recording=new SessionRecording({schema_version:1,input_source:synthetic()?'DEMO':'CAMERA',game_mode:s.mode,music_mode:musicMode,bpm:s.bpm,duration:s.duration,difficulty:s.difficulty,target_size:s.radius,reach_range:s.reach,layout:s.layout,max_targets:s.maxTargets,judgment_windows:s.windows,latency_correction_ms:s.latency,started_at:new Date().toISOString(),performance_time_origin:performance.timeOrigin,time_units:'milliseconds; tracking/observed_timestamp = UNIX epoch; scheduled/hit = audible session clock, corrected for capture latency',spatial_units:'distance divided by stage height',calibration:synthetic()?{synthetic:true}:{registered:identity.calibrated,players:frame?.players,zones:s.zones},camera_settings:synthetic()?null:{mirror,device_id:value('camera-device').value,track_settings:((video.srcObject as MediaStream|null)?.getVideoTracks()[0]?.getSettings()??null),delegate:model.delegate},audio:{volume:+value('reach-volume').value,muted:value('reach-mute').checked},settings:s});
    ['save-tracking','save-events','save-session'].forEach(id=>$<HTMLButtonElement>(id).disabled=false);
    $('results').hidden=true;message((synthetic()?'DEMO INPUT · ':'CAMERA INPUT · ')+'円の外から、ビートに合わせて指定の手を入れてください。');
  }catch(error){if(request!==startGeneration)return;starting=false;audio.stop();lock(false);message(String(error))}
}
function endGame(completed:boolean){
  startGeneration++;
  const hadGame=playing;playing=false;starting=false;audio.stop();lock(false);game?.invalidate();$('countdown').textContent='';
  if(!hadGame||!game)return;
  recording?.finish(game.exportEvents(),completed);
  const result=$('results');result.hidden=false;const g=game;
  result.innerHTML=`<h2>${completed?'SESSION COMPLETE':'SESSION INTERRUPTED'}</h2><h3>${g.settings.mode==='BATTLE'?(completed?(g.winner==='DRAW'?'DRAW':g.winner+' WINS'):'勝敗なし'):g.settings.mode==='CO-OP'?`TEAM SCORE ${g.scores.P1.score+g.scores.P2.score}`:`SCORE ${g.scores.P1.score}`}</h3>${(['P1','P2'] as const).filter(p=>p==='P1'||g.settings.mode!=='SOLO').map(p=>{const s=g.scores[p];return `<p>${p} · ${s.score} · MAX COMBO ${s.maxCombo}</p><p>PERFECT ${s.counts.PERFECT} / GREAT ${s.counts.GREAT} / GOOD ${s.counts.GOOD} / MISS ${s.counts.MISS}</p>`}).join('')}`;
  message(completed?'ゲーム終了。STARTで再プレイできます。':'ゲームを中断しました。');
}

$('camera-start').onclick=()=>{resetRegistration();void session.start(mirror)};
$('camera-stop').onclick=stopCamera;
$('camera-switch').onclick=()=>{stopCamera();resetRegistration();void session.start(mirror)};
$('recover').onclick=()=>{recoveryAttempts=0;endGame(false);void recover()};
$('recalibrate').onclick=resetRegistration;
$('play').onclick=()=>void startGame();$('end').onclick=()=>endGame(false);
$('player-count').onchange=()=>{value('game-mode').value=value('player-count').value==='SOLO'?'SOLO':'CO-OP';resetRegistration()};
$('game-mode').onchange=()=>{value('player-count').value=value('game-mode').value==='SOLO'?'SOLO':'DUO';resetRegistration()};
$('active-hand').onchange=resetRegistration;
$('mirror').onchange=()=>{mirror=value('mirror').checked;session.setPresentation(value('background').checked,mirror);resetRegistration()};
$('background').onchange=()=>session.setPresentation(value('background').checked,mirror);
function inputSourceChanged(){stopCamera();lastSuccess=0;demoInput.keys.clear();$('demo-help').hidden=!synthetic();$('demo-controls').hidden=!synthetic();session.setPresentation(!synthetic()&&value('background').checked,mirror);['camera-start','camera-switch','recover'].forEach(id=>$<HTMLButtonElement>(id).disabled=synthetic());resetRegistration()}
$('input-source').onchange=inputSourceChanged;
$('music-mode').onchange=()=>{endGame(false);message('ジャンルを変更しました。STARTで新しい伴奏を開始します。')};
function volumeChanged(){audio.setVolume(+value('reach-volume').value,value('reach-mute').checked)}
$('reach-volume').oninput=volumeChanged;$('reach-mute').onchange=volumeChanged;
for(const player of ['P1','P2'] as const)$('demo-'+player.toLowerCase()).onchange=()=>{demoInput.hands[player]=value('demo-'+player.toLowerCase()).value as Side|'BOTH';game?.invalidate()};
const demoStage=$('reach-stage');
function moveDemo(e:PointerEvent){if(!synthetic())return;const r=demoStage.getBoundingClientRect();demoInput.moveP1((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height)}
demoStage.onpointerdown=e=>{if(synthetic()){demoStage.setPointerCapture(e.pointerId);moveDemo(e)}};demoStage.onpointermove=moveDemo;
addEventListener('keydown',e=>{
  if(!synthetic()||/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName))return;
  if(e.key.startsWith('Arrow')){e.preventDefault();demoInput.keys.add(e.key)}
  const shortcuts:Record<string,['P1'|'P2',Side|'BOTH']>={q:['P1','L'],e:['P1','R'],b:['P1','BOTH'],j:['P2','L'],k:['P2','R'],u:['P2','BOTH']};
  const action=shortcuts[e.key.toLowerCase()];if(action){demoInput.hands[action[0]]=action[1];value('demo-'+action[0].toLowerCase()).value=action[1];game?.invalidate()}
});
addEventListener('keyup',e=>demoInput.keys.delete(e.key));addEventListener('blur',()=>demoInput.keys.clear());
function save(kind:'tracking'|'events'|'session'){
  if(!recording||!game)return;if(playing){recording.events=game.exportEvents();recording.metadata.completed=false}
  downloadFile(kind+(kind==='session'?'.json':'.csv'),kind==='session'?recording.json():kind==='tracking'?recording.trackingCsv():recording.eventsCsv(),kind==='session'?'application/json':'text/csv;charset=utf-8');
}
$('save-tracking').onclick=()=>save('tracking');$('save-events').onclick=()=>save('events');$('save-session').onclick=()=>save('session');
function setDemo(on:boolean){endGame(false);demo=on;$('game-tab').setAttribute('aria-pressed',String(!on));$('demo-tab').setAttribute('aria-pressed',String(on));$('game-settings').hidden=on;$('play').hidden=on;$('end').hidden=on;$('stage-caption').textContent=on?'DUO TRACKING / LIVE DIAGNOSTICS':'REACH • RETURN • REPEAT';if(on){value('player-count').value='DUO';value('game-mode').value='CO-OP';resetRegistration()}}
$('game-tab').onclick=()=>setDemo(false);$('demo-tab').onclick=()=>setDemo(true);
value('difficulty').value='NORMAL';
addEventListener('pagehide',()=>{stopCamera();audio.close()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){endGame(false);game?.invalidate()}});

const colors={P1:'#59aaff',P2:'#ff637a'};
function drawLine(points:Point[],chain:number[],color:string,w:number,h:number,pose=true){
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();let first=true;
  chain.forEach(i=>{const p=points[i];if(!p||(pose&&(p.visibility??1)<.5)){first=true;return}const q=displayPointForCamera(p,mirror);if(first)ctx.moveTo(q.x*w,q.y*h);else ctx.lineTo(q.x*w,q.y*h);first=false});ctx.stroke();
}
function draw(now:number){
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.font='bold 13px system-ui';ctx.textAlign='center';
  const fresh=frame&&performance.now()-frame.timestamp<750;
  if(fresh){
    for(const p of frame!.players){
      if(p.status!=='TRACKING')continue;
      if(value('body-lines').checked){[[11,12,24,23,11],[11,13,15],[12,14,16],[23,25,27],[24,26,28]].forEach(c=>drawLine(p.pose,c,colors[p.id],w,h))}
      const q=displayPointForCamera(p.pose[11],mirror);ctx.fillStyle=colors[p.id];ctx.fillText(p.id,q.x*w,q.y*h-18);
    }
    for(const hand of frame!.hands){
      if(hand.status!=='TRACKING')continue;
      if(value('hand-lines').checked)[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[17,0]].forEach(c=>drawLine(hand.points,c,colors[hand.player],w,h,false));
    }
  }
  if(playing&&game){
    for(const n of game.visible(now)){
      if(n.grade||n.time-now>1800||now-n.time>game.settings.windows.good)continue;
      const x=n.x*w,y=n.y*h,r=n.radius*h,until=Math.max(0,(n.time-now)/1800);
      ctx.strokeStyle=n.required.length>1?'#c9b1ff':colors[n.required[0].player];ctx.fillStyle=ctx.strokeStyle+'28';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(x,y,r*(1+until*1.8),0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#fff';ctx.fillText(n.required.map(r=>r.player+'-'+r.side).join(' + '),x,y+4);ctx.font='10px system-ui';ctx.fillText(n.pattern,x,y+r+16);ctx.font='bold 13px system-ui';
    }
    const feedback=game.feedback.filter(f=>now-f.time<650).at(-1);
    if(feedback){ctx.fillStyle=feedback.grade==='MISS'?'#ff637a':'#e8f9ff';ctx.font='bold 26px system-ui';ctx.fillText(`${feedback.player} ${feedback.grade}`,w/2,h*.88)}
  }
  if(synthetic()&&value('body-lines').checked){for(const player of ['P1','P2'] as const){if(player==='P2'&&settings().mode==='SOLO')continue;ctx.strokeStyle=colors[player];const cx=settings().mode==='SOLO'?.5:player==='P1'?.25:.75;ctx.beginPath();ctx.moveTo(cx*w,.4*h);ctx.lineTo(cx*w,.75*h);ctx.stroke()}}
  if(synthetic()&&value('hand-lines').checked)for(const c of cursors()){const cx=settings().mode==='SOLO'?.5:c.player==='P1'?.25:.75;ctx.strokeStyle=colors[c.player];ctx.beginPath();ctx.moveTo(cx*w,.45*h);ctx.lineTo(c.x*w,c.y*h);ctx.stroke()}
  if(fresh||synthetic())for(const c of cursors()){
    ctx.fillStyle=c.status==='TRACKING'?colors[c.player]:'#999';ctx.beginPath();ctx.arc(c.x*w,c.y*h,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 12px system-ui';ctx.fillText(`${c.player}-${c.side}`,c.x*w,c.y*h-16);
  }
}
let lastTelemetry=0;
function telemetry(t:number){
  if(t-lastTelemetry<120)return;lastTelemetry=t;
  const fresh=frame&&t-frame.timestamp<750;
  $('tracking-info').textContent=`${fresh?frame!.people:0} PEOPLE · ${fresh?frame!.handCount:0} HANDS · ${renderFps} RENDER FPS / ${trackingFps} TRACK FPS · ${inferenceMs.toFixed(0)}ms INFERENCE · ${model.delegate}`;
  const measured=frameReceivedAt>0&&t-frameReceivedAt<1500;
  $('inference-info').textContent=`POSE FPS ${measured?trackingFps:'—'} / HAND FPS ${measured?trackingFps:'—'} · INFERENCE TIME Pose ${poseMs?.toFixed(1)??'—'}ms / Hand ${handMs?.toFixed(1)??'—'}ms · HAND DETECTION COUNT ${measured?frame?.handCount??0:'—'} · ${model.busy?'IN FLIGHT (QUEUE 0)':'IDLE (QUEUE 0)'}`;
  $('hands-info').innerHTML=(['P1','P2'] as const).slice(0,identity.count).flatMap(player=>(['L','R'] as const).map(side=>{
    const hand=frame?.hands.find(h=>h.player===player&&h.side===side),point=hand?.points[8],q=point?displayPointForCamera(point,mirror):undefined;
    return `<p class="${player.toLowerCase()}">${player}-${side} <b>${fresh?hand?.status??'LOST':'LOST'}</b> X ${fresh&&q?q.x.toFixed(3):'—'} / Y ${fresh&&q?q.y.toFixed(3):'—'} · ${fresh?hand?.reason??'対応済み':'検出結果なし'}</p>`;
  })).join('');
  $('calibration-status').textContent=identity.needsRegistration?'ID不確定 — 再キャリブレーションしてください':currentReady()?'READY — 登録済み':identity.calibrated?'LOST / UNCERTAIN — HIT停止':'手を上げて登録中';
  const calibration=identity.calibration(t),timedOut=!identity.calibrated&&session.active&&t-registrationResetAt>=10000;
  $('calibration-progress').textContent=`CALIBRATION PROGRESS ${Math.round(calibration.progress*100)}% · HOLD ${identity.holdMs/1000}s${timedOut?' · 10秒以上未完了':''}`;
  $('tracking-reason').textContent=[diagnosticError,model.warning,timedOut?'未完了の理由: '+calibration.reason:calibration.reason,frame?.handCount===0?'手を画面内に収め、明るい場所で指を開いてください。改善しなければRECOVER TRACKINGでCPUを試してください。':'',inferenceMs>250?'推論が250msを超えています。HITを停止します。':''].filter(Boolean).join(' / ');
  if(timedOut)$('calibration-status').textContent='登録未完了 — '+calibration.reason;
  if(synthetic()){$('calibration-status').textContent='DEMO READY — カメラ登録なし';$('tracking-info').textContent=`DEMO INPUT · ${renderFps} FPS · 合成カーソル（実測の手・人数ではありません）`;$('hands-info').textContent=cursors().map(c=>`${c.player}-${c.side} X ${c.x.toFixed(3)} Y ${c.y.toFixed(3)}`).join(' / ')}
  if(synthetic()){$('inference-info').textContent='POSE / HAND: DEMOでは実行しません';$('calibration-progress').textContent='CALIBRATION: DEMO（対象外）';$('tracking-reason').textContent=''}
  $('recording-status').textContent=recording?`${recording.metadata.input_source} · ${recording.tracking.length} tracking rows · ${game?.events.length??0} judged events`:'セッション開始後に記録します。';
  $<HTMLButtonElement>('play').disabled=playing||starting||!currentReady();
  const s=playing&&game?game.settings:settings();$('tempo').textContent=`${s.bpm} BPM`;
  $('remaining').textContent=`${Math.max(0,s.duration-(playing?Math.max(0,audio.now()/1000):0)).toFixed(1)} SEC`;
  for(const p of ['P1','P2'] as const){$(`${p.toLowerCase()}-score`).textContent=String(game?.scores[p].score??0);$(`${p.toLowerCase()}-combo`).textContent=`COMBO ${game?.scores[p].combo??0}`}
}
function loop(t:number){
  if(synthetic()){demoInput.step(lastDemoTime?(t-lastDemoTime)/1000:0);lastDemoTime=t;if(playing&&game){const capture=performance.now();game.sample(cursors(),audio.at(capture),canvas.clientWidth/canvas.clientHeight,performance.timeOrigin+capture);recordTracking(capture)}}
  // Submit at most one new full-resolution frame. Results arrive without blocking rendering.
  if(session.active&&trackingReady&&!recovering&&!model.busy&&video.readyState>=2&&video.currentTime!==lastVideo&&t-lastInference>=50){
    lastVideo=video.currentTime;lastInference=t;const capture=performance.now();
    const generation=cameraGeneration;
    void model.detect(video,capture).then(raw=>{
      if(raw&&generation===cameraGeneration&&raw.timestamp>=registrationResetAt){
        inferenceMs=performance.now()-capture;lastSuccess=performance.now();frameReceivedAt=lastSuccess;inferences++;poseMs=raw.poseMs;handMs=raw.handMs;
        frame=identity.update(raw);
        if(playing&&game){
          recordTracking(capture);
          if(inferenceMs<=250)game.sample(cursors(),audio.at(capture)-game.settings.latency,canvas.clientWidth/canvas.clientHeight,performance.timeOrigin+capture);
          else game.invalidate();
        }
      }
    }).catch(error=>{if(generation!==cameraGeneration||capture<registrationResetAt)return;trackingReady=false;frame=undefined;game?.invalidate();diagnosticError=`推論エラー: ${String(error)}`;message(diagnosticError);if(recoveryAttempts++<2)void recover()});
  }
  if(session.active&&!recovering&&!model.busy&&performance.now()>nextRecovery&&lastSuccess&&performance.now()-lastSuccess>3000&&recoveryAttempts<2){recoveryAttempts++;diagnosticError='3秒間新しい推論結果がありません。CPUで再起動します。';void recover()}
  const now=audio.now();
  if(playing&&game){
    if(!synthetic()&&performance.now()-lastRecordTime>250)recordTracking(performance.now(),true);
    for(const event of game.events.slice(soundedEvents))audio.hit(event.player_id,event.judgement);soundedEvents=game.events.length;
    if(!audio.running){endGame(false);message('音声が停止したためゲームを中断しました。')}
    else{
      // Allow one inference interval plus the configured capture delay before finalizing misses.
      game.expire(now-Math.max(0,game.settings.latency)-(model.busy?Math.min(500,performance.now()-lastInference)+100:100));
      $('countdown').textContent=now<0?String(Math.min(3,Math.ceil(-now/1000))):now<600?'START':'';
      if(now>game.settings.duration*1000+game.settings.windows.good+400)endGame(true);
    }
  }
  draw(now);renders++;
  if(t-fpsAt>=1000){renderFps=Math.round(renders*1000/(t-fpsAt));trackingFps=Math.round(inferences*1000/(t-fpsAt));renders=0;inferences=0;fpsAt=t}
  telemetry(performance.now());requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function recordTracking(timestamp:number,missing=false){
  if(!recording||!playing)return;lastRecordTime=timestamp;
  const cs=missing?[]:cursors();
  for(const player of (game?.settings.mode==='SOLO'?['P1']:['P1','P2']) as ('P1'|'P2')[])for(const side of ['L','R'] as const){
    const cursor=cs.find(c=>c.player===player&&c.side===side),hand=frame?.hands.find(h=>h.player===player&&h.side===side);
    recording.tracking.push({timestamp:performance.timeOrigin+timestamp,player_id:player,hand_side:side,x:cursor?.x??null,y:cursor?.y??null,tracking_status:cursor?.status??'LOST',confidence:synthetic()||missing?null:hand?.confidence??null,fps:synthetic()?renderFps||null:trackingFps||null,input_source:synthetic()?'DEMO':'CAMERA'});
  }
}
