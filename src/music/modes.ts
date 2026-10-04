import type { Edge } from '../performance/frame';

export type MusicMode = 'band' | 'techno' | 'ambient' | 'dub' | 'dubstep' | 'jungle';
export type Rhythm = '8 beat' | 'funk' | 'bossa nova' | 'four on the floor' | 'dub' | 'free time' | 'half-time' | 'breakbeat';
export type ModeConfig = {
  label: string; bpm: number; rhythm: Rhythm; rhythms: Rhythm[];
  roles: Record<Edge,string>; color: string; quantize: '4n'|'8n'|'16n'|null;
};

export const MODES:Record<MusicMode,ModeConfig>={
  band:{label:'BAND',bpm:100,rhythm:'8 beat',rhythms:['8 beat','funk','bossa nova'],color:'#ffcf70',quantize:'8n',roles:{top:'PIANO / HORN',bottom:'KICK / BASS',left:'SNARE / HAT',right:'GUITAR / CHORD'}},
  techno:{label:'TECHNO',bpm:125,rhythm:'four on the floor',rhythms:['four on the floor'],color:'#5ff6ff',quantize:'16n',roles:{top:'LEAD / ARP',bottom:'KICK / SUB',left:'HAT / PERC',right:'STAB / FILTER'}},
  ambient:{label:'AMBIENT',bpm:60,rhythm:'free time',rhythms:['free time'],color:'#bd85ff',quantize:null,roles:{top:'OVERTONE',bottom:'LOW DRONE',left:'TEXTURE',right:'SPACE / REVERB'}},
  dub:{label:'DUB',bpm:75,rhythm:'dub',rhythms:['dub'],color:'#7dff9b',quantize:'8n',roles:{top:'ORGAN / MELODY',bottom:'BASS / KICK',left:'SNARE / RIM',right:'DELAY / REVERB'}},
  dubstep:{label:'DUBSTEP',bpm:140,rhythm:'half-time',rhythms:['half-time'],color:'#ff557f',quantize:'16n',roles:{top:'BASS STAB / LEAD',bottom:'KICK / SUB',left:'SNARE / PERC',right:'WOBBLE / FILTER'}},
  jungle:{label:'JUNGLE',bpm:170,rhythm:'breakbeat',rhythms:['breakbeat'],color:'#d7ff45',quantize:'16n',roles:{top:'HIGH PERC / CHOP',bottom:'KICK / BASS',left:'SNARE / GHOST',right:'BREAK / FILL'}},
};

export const modeNames=Object.keys(MODES) as MusicMode[];
