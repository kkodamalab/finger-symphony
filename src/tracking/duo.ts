import {FilesetResolver, HandLandmarker, PoseLandmarker} from '@mediapipe/tasks-vision';

export type Point = {x:number;y:number;z?:number;visibility?:number};
export type PlayerId = 'P1'|'P2';
export type Side = 'L'|'R';
export type Status = 'TRACKING'|'LOST'|'UNCERTAIN';
export type RawFrame = {poses:Point[][];hands:Point[][];timestamp:number};
export type TrackedHand = {player:PlayerId;side:Side;status:Status;points:Point[];confidence?:number};
export type Player = {id:PlayerId;status:Status;pose:Point[];lastSeen:number};
export type DuoFrame = {players:Player[];hands:TrackedHand[];timestamp:number;people:number;handCount:number};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const visible=(p:Point|undefined):p is Point=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.6;
const center=(p:Point[])=>({x:(p[11].x+p[12].x)/2,y:(p[11].y+p[12].y)/2});
const bodyCost=(a:Point[],b:Point[])=>distance(center(a),center(b));

/** IDs are assigned once in display space; uncertain observations never move an anchor. */
export class IdentityTracker {
  players:Player[]=[];
  private stableSince:number|undefined;
  private lastFrame=-Infinity;
  calibrated=false;
  needsRegistration=false;
  constructor(public count:1|2=2,public mirrored=true,public activeHand:'BOTH'|Side='BOTH'){}
  reset(){this.players=[];this.stableSince=undefined;this.lastFrame=-Infinity;this.calibrated=false;this.needsRegistration=false}
  update(raw:RawFrame):DuoFrame {
    const t=raw.timestamp;
    const poses=raw.poses.filter(p=>visible(p[11])&&visible(p[12]));
    if(t-this.lastFrame>250)this.stableSince=undefined;
    this.lastFrame=t;
    if(!this.players.length&&poses.length===this.count){
      const ordered=[...poses].sort((a,b)=>(center(a).x-center(b).x)*(this.mirrored?-1:1));
      this.players=ordered.map((pose,i)=>({id:i===0?'P1':'P2',pose,lastSeen:t,status:'UNCERTAIN'}));
    }
    // Enumerate injective assignments including a missing detection.
    const assignments:{indices:number[];cost:number}[]=[];
    const visit=(indices:number[],cost:number)=>{
      if(indices.length===this.players.length){assignments.push({indices,cost});return}
      const player=this.players[indices.length];
      visit([...indices,-1],cost+.24);
      poses.forEach((pose,i)=>{if(!indices.includes(i))visit([...indices,i],cost+bodyCost(player.pose,pose))});
    };
    visit([],0);assignments.sort((a,b)=>a.cost-b.cost);
    const best=assignments[0];
    const ambiguous=!!assignments[1]&&assignments[1].cost-best.cost<.055;
    const overlap=poses.length===2&&distance(center(poses[0]),center(poses[1]))<.15;
    // Once people overlap, geometry alone cannot tell whether they crossed or turned back.
    // Never silently relabel them when they separate on the opposite sides.
    if(ambiguous||overlap||this.players.some(p=>t-p.lastSeen>1500)){
      this.needsRegistration=true;this.calibrated=false;
    }
    this.players=this.players.map((p,i)=>{
      const pose=poses[best.indices[i]];
      if(!pose)return {...p,status:'LOST'};
      // After a long absence identity cannot be proven without registration.
      if(this.needsRegistration||bodyCost(p.pose,pose)>.22)return {...p,status:'UNCERTAIN'};
      return {...p,pose,lastSeen:t,status:'TRACKING'};
    });
    const slots=this.players.flatMap(p=>(['L','R'] as Side[]).map(side=>({player:p,side,wrist:p.pose[side==='L'?15:16]})));
    const hands:TrackedHand[]=slots.map(s=>({player:s.player.id,side:s.side,status:s.player.status==='UNCERTAIN'?'UNCERTAIN':'LOST',points:[]}));
    // Pose wrists define anatomical left/right; never infer identity from screen side or handedness alone.
    const candidates=raw.hands.map(points=>slots.map((s,i)=>({i,d:s.player.status==='TRACKING'&&visible(s.wrist)&&visible(points[0])?distance(s.wrist,points[0]):Infinity})).sort((a,b)=>a.d-b.d));
    candidates.forEach((rank,h)=>{
      const first=rank[0];if(!first||first.d>.13)return;
      const contested=candidates.some((r,j)=>j!==h&&r[0]?.i===first.i&&r[0].d<.13);
      if(contested||(rank[1]&&rank[1].d-first.d<.035)){hands[first.i].status='UNCERTAIN';return}
      hands[first.i]={...hands[first.i],status:'TRACKING',points:raw.hands[h],confidence:slots[first.i].wrist.visibility};
    });
    const required=hands.filter(h=>this.activeHand==='BOTH'||h.side===this.activeHand);
    const raised=this.players.length===this.count&&this.players.every(p=>p.status==='TRACKING')&&required.length===this.count*(this.activeHand==='BOTH'?2:1)&&required.every(h=>{
      const p=this.players.find(p=>p.id===h.player)!;
      return h.status==='TRACKING'&&h.points[0].y<p.pose[h.side==='L'?11:12].y-.03;
    });
    if(!raised)this.stableSince=undefined;
    else this.stableSince??=t;
    if(this.stableSince!==undefined&&t-this.stableSince>=1000)this.calibrated=true;
    return {players:this.players,hands,timestamp:t,people:raw.poses.length,handCount:raw.hands.length};
  }
}

/** CameraSession remains responsible for camera ownership; this owns only models. */
export class DuoLandmarker {
  private pose?:PoseLandmarker;
  private hand?:HandLandmarker;
  private generation=0;
  delegate:'GPU'|'CPU'='GPU';
  async init(){
    this.close();const generation=this.generation;
    // Match package-lock.json, not a moving @latest WASM runtime.
    const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
    for(const delegate of ['GPU','CPU'] as const){
      let pose:PoseLandmarker|undefined,hand:HandLandmarker|undefined;
      try{
        pose=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate},runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.6,minTrackingConfidence:.6});
        if(generation!==this.generation){pose.close();return}
        hand=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:4,minHandDetectionConfidence:.6,minTrackingConfidence:.6});
        if(generation!==this.generation){pose.close();hand.close();return}
        this.pose=pose;this.hand=hand;this.delegate=delegate;return;
      }catch(error){pose?.close();hand?.close();if(generation!==this.generation)return;if(delegate==='CPU')throw error}
    }
  }
  detect(video:HTMLVideoElement,timestamp:number):RawFrame|undefined{
    if(!this.pose||!this.hand)return;
    const pose=this.pose.detectForVideo(video,timestamp),hand=this.hand.detectForVideo(video,timestamp);
    return {poses:pose.landmarks,hands:hand.landmarks,timestamp};
  }
  close(){this.generation++;this.pose?.close();this.hand?.close();this.pose=undefined;this.hand=undefined}
}
